import {
  Button,
  Grid,
  Theme, Tooltip,
  Typography,
  useMediaQuery,
} from "@material-ui/core";
import {styled, useTheme} from "@material-ui/styles";
import ReactHtmlParser from "react-html-parser";
import {BigNumber} from "bignumber.js";
import ProgressBar from "react-customizable-progressbar";
import {StatusBadge} from "modules/explorer/components/StatusBadge";
import {UserBadge} from "modules/explorer/components/UserBadge";
import {VotersProgress} from "modules/explorer/components/VotersProgress";
import {useCanDropProposal} from "modules/explorer/hooks/useCanDropProposal";
import React, {useCallback, useMemo, useState} from "react";
import {useParams} from "react-router";
import {useAgoraTopic} from "services/agora/hooks/useTopic";
import {BaseDAO} from "services/contracts/baseDAO";
import {useDropProposal} from "services/contracts/baseDAO/hooks/useDropProposal";
import {toShortAddress} from "services/contracts/utils";
import {useDAO} from "services/indexer/dao/hooks/useDAO";
import {useProposal} from "services/indexer/dao/hooks/useProposal";
import {ContentContainer} from "../../components/ContentContainer";
import {useDAOID} from "../DAO/router";
import {useVotesStats} from "modules/explorer/hooks/useVotesStats";
import {formatNumber} from "modules/explorer/utils/FormatNumber";
import {HighlightedBadge} from "modules/explorer/components/styled/HighlightedBadge";
import {TransferBadge} from "modules/explorer/Treasury/components/TransferBadge";
import {
  RegistryProposal,
  TreasuryProposal,
  FA2Transfer,
  ProposalStatus,
} from "services/indexer/dao/mappers/proposal/types";
import {useDAOHoldings} from "services/contracts/baseDAO/hooks/useDAOHoldings";
import {VoteDialog} from "../../components/VoteDialog";
import {XTZTransferBadge} from "../../components/XTZTransferBadge";
import {InfoIcon} from "../../../components/styled/InfoIcon";

const Container = styled(ContentContainer)({
  padding: "36px 45px",
});

const HistoryItem = styled(Grid)(({theme}: { theme: Theme }) => ({
  marginTop: 20,
  paddingBottom: 12,
  display: "flex",
  height: "auto",

  [theme.breakpoints.down("sm")]: {
    width: "unset",
  },
}));

const QuorumTitle = styled(Typography)(() => ({
  color: "#3866F9",
}));

const ProgressText = styled(Typography)(
  ({textColor}: { textColor: string }) => ({
    color: textColor,
    display: "flex",
    alignItems: "center",
    position: "absolute",
    width: "100%",
    height: "100%",
    fontSize: 16,
    userSelect: "none",
    boxShadow: "none",
    background: "inherit",
    fontFamily: "Roboto Mono",
    justifyContent: "center",
    top: 0,
  })
);

const DetailsText = styled(Typography)({
  wordBreak: "break-all",
});

const VoteButton = styled(Button)(({favor}: { favor: boolean }) => ({
  backgroundColor: favor ? "#3FE888" : "#FF486E",
}));

export const ProposalDetails: React.FC = () => {
  const {proposalId} = useParams<{
    proposalId: string;
  }>();
  const daoId = useDAOID();
  const [openVote, setOpenVote] = useState(false);
  const [voteIsSupport, setVoteIsSupport] = useState(false);
  const theme = useTheme<Theme>();
  const {data: proposal} = useProposal(daoId, proposalId);
  const {data: dao, cycleInfo} = useDAO(daoId);
  const isMobileSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const {mutate: dropProposal} = useDropProposal();
  const {data: holdings} = useDAOHoldings(daoId);
  const canDropProposal = useCanDropProposal(daoId, proposalId);
  const {data: agoraPost} = useAgoraTopic(
    Number(proposal?.metadata.agoraPostId)
  );
  const quorumThreshold = proposal?.quorumThreshold || new BigNumber(0);

  const onClickVote = (support: boolean) => {
    setVoteIsSupport(support);
    setOpenVote(true);
  }

  const onCloseVote = () => {
    setOpenVote(false)
  }

  const onDropProposal = useCallback(async () => {
    await dropProposal({
      dao: dao as BaseDAO,
      proposalId,
    });
  }, [dao, dropProposal, proposalId]);

  const proposalCycle = proposal ? proposal.period : "-";

  const {votesQuorumPercentage} = useVotesStats({
    upVotes: proposal?.upVotes || new BigNumber(0),
    downVotes: proposal?.downVotes || new BigNumber(0),
    quorumThreshold,
  });

  const list = useMemo(() => {
    if (!proposal || !(proposal instanceof RegistryProposal)) {
      return [];
    }

    return proposal.metadata.list;
  }, [proposal]);

  const transfers = useMemo(() => {
    if (!holdings || !proposal) {
      return [];
    }

    return (proposal as TreasuryProposal | RegistryProposal).metadata.transfers;
  }, [holdings, proposal]);

  const canVote =
    cycleInfo &&
    proposal?.getStatus(cycleInfo.currentLevel).status ===
    ProposalStatus.ACTIVE;

  return (
    <>
      <Grid container direction="column" style={{gap: 42}}>
        <Container item>
          <Grid container direction="column" style={{gap: 18}}>
            <Grid item container style={{gap: 21}}>
              <Grid item>
                <Typography
                  variant="h3"
                  color="textPrimary"
                  align={isMobileSmall ? "center" : "left"}
                >
                  {agoraPost
                    ? agoraPost.title
                    : `Proposal ${toShortAddress(proposal?.id || "")}`}
                </Typography>
              </Grid>
              <Grid>
                <Button
                  variant="contained"
                  color="secondary"
                  disabled={!canDropProposal}
                  onClick={onDropProposal}
                >
                  Drop Proposal
                </Button>
                <Tooltip
                  placement="bottom"
                  title="Guardian and proposer may drop proposal at anytime. Anyone may drop proposal if proposal expired"
                >
                  <InfoIcon color="secondary" />
                </Tooltip>
              </Grid>
            </Grid>
            <Grid item>
              <Grid
                container
                justifyContent="space-between"
                alignItems="center"
              >
                <Grid item>
                  {proposal && cycleInfo && (
                    <Grid container style={{gap: 20}}>
                      <Grid item>
                        <StatusBadge
                          status={
                            proposal.getStatus(cycleInfo.currentLevel).status
                          }
                        />
                      </Grid>
                      <Grid item>
                        <Typography color="textPrimary" variant="subtitle2">
                          CREATED BY
                        </Typography>
                      </Grid>
                      <Grid item>
                        <UserBadge address={proposal.proposer} short={true}/>
                      </Grid>
                    </Grid>
                  )}
                </Grid>
                <Grid item>
                  <Grid container style={{gap: 28}}>
                    <Grid item>
                      <VoteButton variant="contained" favor={true} onClick={() => onClickVote(true)}
                                  disabled={!canVote}>
                        Vote For
                      </VoteButton>
                    </Grid>
                    <Grid item>
                      <VoteButton variant="contained" favor={false} onClick={() => onClickVote(false)}
                                  disabled={!canVote}>
                        Vote Against
                      </VoteButton>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Container>
        <Grid item>
          <Grid container style={{gap: 45}}>
            <Container item xs={12} md={7}>
              <Grid container direction="column" style={{gap: 18}}>
                <Grid item>
                  <Grid container style={{gap: 18}}>
                    <Grid item>
                      <Typography color="secondary">Votes</Typography>
                    </Grid>
                    <Grid item>
                      <Typography color="textPrimary">
                        Cycle: {proposalCycle}
                      </Typography>
                    </Grid>
                  </Grid>
                </Grid>
                <Grid item>
                  <VotersProgress
                    showButton={true}
                    daoId={daoId}
                    proposalId={proposalId}
                  />
                </Grid>
              </Grid>
            </Container>
            <Container item xs>
              <Grid
                container
                direction="row"
                style={{height: "100%"}}
                alignItems="center"
                wrap="nowrap"
              >
                <Grid item>
                  <ProgressBar
                    progress={proposal ? votesQuorumPercentage.toNumber() : 0}
                    radius={50}
                    strokeWidth={7}
                    strokeColor="#3866F9"
                    trackStrokeWidth={4}
                    trackStrokeColor={theme.palette.primary.light}
                  >
                    <div className="indicator">
                      <ProgressText textColor="#3866F9">
                        {proposal
                          ? `${formatNumber(votesQuorumPercentage)}%`
                          : "-"}
                      </ProgressText>
                    </div>
                  </ProgressBar>
                </Grid>
                <Grid item>
                  <Grid
                    container
                    direction="column"
                    alignItems="flex-start"
                    justifyContent="center"
                    wrap="nowrap"
                    style={{height: "100%"}}
                  >
                    <Grid item>
                      { proposal && (<Tooltip
                        placement="bottom"
                        title={`Amount of ${dao?.data.token.symbol} required to be locked through voting for a proposal to be passed/rejected. ${(proposal.upVotes.gte(proposal.downVotes)? proposal.upVotes.toString(): proposal.downVotes.toString()) }/${quorumThreshold} votes.`}
                      >
                        <InfoIcon color="secondary"/>
                      </Tooltip>)}
                      <QuorumTitle color="textPrimary">
                        Quorum Threshold:
                      </QuorumTitle>
                    </Grid>
                    <Grid item>
                      <Typography color="textPrimary">
                        {proposal ? quorumThreshold.toString() : "-"}
                      </Typography>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </Container>
          </Grid>
        </Grid>
        <Container item>
          <Grid container direction="column" style={{gap: 40}}>
            {agoraPost && (
              <Grid item>
                <Typography
                  color="textPrimary"
                  variant="body1"
                  align={isMobileSmall ? "center" : "left"}
                >
                  {ReactHtmlParser(agoraPost.post_stream.posts[0].cooked)}
                </Typography>
              </Grid>
            )}

            <Grid item container style={{gap: 25}}>
              {proposal ? (
                <>
                  {transfers.map((transfer, index) => {
                    return (
                      <Grid
                        key={index}
                        item
                        container
                        alignItems="center"
                        direction={isMobileSmall ? "column" : "row"}
                      >
                        {transfer.type === "XTZ" ? (
                          <XTZTransferBadge
                            amount={transfer.amount}
                            address={transfer.beneficiary}
                          />
                        ) : (
                          <TransferBadge
                            amount={transfer.amount}
                            address={transfer.beneficiary}
                            contract={(transfer as FA2Transfer).contractAddress}
                            tokenId={(transfer as FA2Transfer).tokenId}
                          />
                        )}
                      </Grid>
                    );
                  })}
                  {list.map(({key, value}, index) => (
                    <Grid
                      key={index}
                      item
                      container
                      alignItems="center"
                      direction={isMobileSmall ? "column" : "row"}
                    >
                      <HighlightedBadge
                        justify="center"
                        alignItems="center"
                        direction="row"
                        container
                      >
                        <Grid item>
                          <DetailsText variant="body1" color="textPrimary">
                            Set &quot;{key}&quot; to &quot;{value}&quot;
                          </DetailsText>
                        </Grid>
                      </HighlightedBadge>
                    </Grid>
                  ))}
                </>
              ) : null}
            </Grid>
          </Grid>
        </Container>
        <Grid item>
          <Grid container>
            <Container item md={7} xs={12}>
              {cycleInfo &&
                proposal
                  ?.getStatus(cycleInfo.currentLevel)
                  .statusHistory.map((item, index) => {
                  return (
                    <HistoryItem
                      container
                      direction="row"
                      key={index}
                      alignItems="baseline"
                      wrap="nowrap"
                      xs={12}
                      style={{gap: 32}}
                    >
                      <Grid item>
                        <StatusBadge item status={item.status}/>
                      </Grid>
                      <Grid item>
                        <Typography color="textPrimary" variant="subtitle2">
                          {item.timestamp}
                        </Typography>
                      </Grid>
                    </HistoryItem>
                  );
                })}
            </Container>
          </Grid>
        </Grid>
      </Grid>
      <VoteDialog open={openVote} support={voteIsSupport} onClose={onCloseVote}/>
    </>
  );
};
