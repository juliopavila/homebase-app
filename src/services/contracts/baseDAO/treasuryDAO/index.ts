import { TezosToolkit } from "@taquito/taquito";

import { getLedgerAddresses } from "services/bakingBad/ledger";
import { getProposalsDTO } from "services/bakingBad/proposals";
import { getStorage } from "services/bakingBad/storage";
import { Network } from "services/beacon/context";
import { DAOListMetadata } from "../../metadataCarrier/types";
import { Schema } from "@taquito/michelson-encoder";
import { Parser, Expr } from "@taquito/michel-codec";
import { BaseDAO, getContract } from "..";
import { TreasuryProposal } from "services/bakingBad/proposals/types";
import { TreasuryExtraDTO, TreasuryProposeArgs } from "./types";
import { getExtra } from "services/bakingBad/extra";
import proposeCode from "./michelson/propose";
import {
  extractTransfersData,
  mapProposalBase,
  mapTransfersArgs,
} from "services/bakingBad/proposals/mappers";
import { PMTreasuryProposal } from "../registryDAO/types";
import { getTokenMetadata } from "services/bakingBad/tokens";
import { char2Bytes } from "@taquito/tzip16";

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
      frozenExtraValue: Number(char2Bytes(extraDTO[1].data.value.value)),
      slashExtraValue: Number(char2Bytes(extraDTO[2].data.value.value)),
      minXtzAmount: Number(char2Bytes(extraDTO[3].data.value.value)),
      maxXtzAmount: Number(char2Bytes(extraDTO[4].data.value.value)),
      frozenScaleValue: Number(char2Bytes(extraDTO[5].data.value.value)),
      slashDivisionScale: Number(char2Bytes(extraDTO[6].data.value.value)),
    };
    const ledger = await getLedgerAddresses(storage.ledgerMapNumber, network);

    return new TreasuryDAO({
      address: contractAddress,
      ledger,
      template: "treasury",
      storage,
      metadata,
      tezos,
      extra,
      network,
    });
  };

  public proposals = async (): Promise<TreasuryProposal[]> => {
    const { proposalsMapNumber } = this.storage;
    const proposalsDTO = await getProposalsDTO(
      proposalsMapNumber,
      this.network
    );

    const tokenMetadata = await getTokenMetadata(
      this.storage.governanceToken.address,
      this.network,
      this.storage.governanceToken.tokenId.toString()
    );

    const schema = new Schema(parser.parseData(proposeCode) as Expr);

    const proposals = proposalsDTO.map((dto) => {
      const proposalMetadata = dto.data.value.children[1].value;

      const proposalMetadataNoBraces = proposalMetadata.substr(
        2,
        proposalMetadata.length - 4
      );
      const michelsonExpr = parser.parseData(proposalMetadataNoBraces);
      const proposalMetadataDTO: PMTreasuryProposal =
        schema.Execute(michelsonExpr);

      const transfers = extractTransfersData(proposalMetadataDTO.transfers);

      return {
        ...mapProposalBase(
          dto,
          "treasury",
          tokenMetadata.supply / 10 ** tokenMetadata.decimals
        ),
        agoraPostId: proposalMetadataDTO.agora_post_id.toString(),
        transfers,
      };
    });

    return proposals;
  };

  public propose = async ({ agoraPostId, transfers }: TreasuryProposeArgs) => {
    const contract = await getContract(this.tezos, this.address);

    const michelsonType = parser.parseData(proposeCode);
    const schema = new Schema(michelsonType as Expr);
    const data = schema.Encode({
      agora_post_id: agoraPostId,
      transfers: mapTransfersArgs(transfers, this.address),
    });

    const { packed: proposalMetadata } = await this.tezos.rpc.packData({
      data,
      type: michelsonType as Expr,
    });

    const contractMethod = contract.methods.propose(
      this.extra.frozenExtraValue,
      proposalMetadata
    );

    const result = await contractMethod.send();
    return result;
  };
}
