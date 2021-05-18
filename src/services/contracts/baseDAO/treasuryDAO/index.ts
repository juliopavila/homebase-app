import { TezosToolkit } from "@taquito/taquito";

import { getLedgerAddresses } from "services/bakingBad/ledger";
import { getOriginationTime } from "services/bakingBad/operations";
import { getProposalsDTO } from "services/bakingBad/proposals";
import { getStorage } from "services/bakingBad/storage";
import { Network } from "services/beacon/context";
import { DAOListMetadata } from "../../metadataCarrier/types";
import { Schema } from "@taquito/michelson-encoder";
import { Parser, Expr } from "@taquito/michel-codec";
import { BaseDAO, getContract, TransferParams } from "..";
import { TransferProposal } from "services/bakingBad/proposals/types";
import { TreasuryExtraDTO } from "./types";
import { getExtra } from "services/bakingBad/extra";
import proposeCode from "./michelson/propose";
import {
  dtoToVoters,
  extractTransfersData,
  mapFA2TransfersArgs,
  mapXTZTransfersArgs,
} from "services/bakingBad/proposals/mappers";
import { ProposalMetadata } from "../registryDAO/types";

const parser = new Parser();

export class TreasuryDAO extends BaseDAO {
  public static create = async (
    contractAddress: string,
    network: Network,
    tezos: TezosToolkit,
    metadata: DAOListMetadata
  ) => {
    const storage = await getStorage(contractAddress, network);
    const extraDTO = await getExtra<TreasuryExtraDTO>(
      storage.extraMapNumber,
      network
    );
    const extra = {
      frozenExtraValue: Number(extraDTO[1].data.value.value),
      slashExtraValue: Number(extraDTO[2].data.value.value),
      minXtzAmount: Number(extraDTO[3].data.value.value),
      maxXtzAmount: Number(extraDTO[4].data.value.value),
      frozenScaleValue: Number(extraDTO[5].data.value.value),
      slashDivisionScale: Number(extraDTO[6].data.value.value),
    };
    const ledger = await getLedgerAddresses(storage.ledgerMapNumber, network);
    const originationTime = await getOriginationTime(contractAddress, network);

    return new TreasuryDAO({
      address: contractAddress,
      ledger,
      template: "treasury",
      originationTime,
      storage,
      metadata,
      tezos,
      extra,
      network,
    });
  };

  public proposals = async (): Promise<TransferProposal[]> => {
    const { proposalsMapNumber } = this.storage;
    const proposalsDTO = await getProposalsDTO(
      proposalsMapNumber,
      this.network
    );

    const schema = new Schema(parser.parseData(proposeCode) as Expr);

    const proposals = proposalsDTO.map((dto) => {
      const proposalMetadata = dto.data.value.children[1].value;

      const proposalMetadataNoBraces = proposalMetadata.substr(
        2,
        proposalMetadata.length - 4
      );
      const michelsonExpr = parser.parseData(proposalMetadataNoBraces);
      const proposalMetadataDTO: ProposalMetadata = schema.Execute(
        michelsonExpr
      );

      const { agoraPostId, transfers } = extractTransfersData(
        proposalMetadataDTO
      );

      return {
        id: dto.data.key.value,
        upVotes: Number(dto.data.value.children[7].value),
        downVotes: Number(dto.data.value.children[0].value),
        startDate: dto.data.value.children[6].value,
        agoraPostId: agoraPostId.toString(),
        proposer: dto.data.value.children[3].value,
        proposerFrozenTokens: dto.data.value.children[5].value,
        transfers,
        cycle: Number(dto.data.value.children[2].value),
        voters: dtoToVoters(dto.data.value.children[8]),
        type: "transfer" as const,
      };
    });

    return proposals;
  };

  public proposeTransfer = async ({
    tokensToFreeze,
    agoraPostId,
    transfers,
  }: {
    tokensToFreeze: number;
    agoraPostId: number;
    transfers: TransferParams[];
  }) => {
    const contract = await getContract(this.tezos, this.address);

    const michelsonType = parser.parseData(proposeCode);
    const schema = new Schema(michelsonType as Expr);
    const data = schema.Encode({
      agora_post_id: agoraPostId,
      transfers: transfers.map((transfer) => {
        if (transfer.type === "FA2") {
          return {
            token_transfer: mapFA2TransfersArgs(transfer, this.address),
          };
        } else {
          return {
            xtz_transfer: mapXTZTransfersArgs(transfer),
          };
        }
      }),
    });

    const { packed: proposalMetadata } = await this.tezos.rpc.packData({
      data,
      type: michelsonType as Expr,
    });

    const contractMethod = contract.methods.propose(
      tokensToFreeze,
      proposalMetadata
    );

    const result = await contractMethod.send();
    return result;
  };
}
