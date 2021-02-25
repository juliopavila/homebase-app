import {
  Box,
  Grid,
  styled,
  Typography,
  LinearProgress,
} from "@material-ui/core";
import React, { useMemo } from "react";
import { useParams } from "react-router-dom";

import { NewProposalDialog } from "modules/explorer/components/NewProposalDialog";
import {
  ProposalTableRowData,
  ProposalTableRow,
  mapProposalData,
} from "modules/explorer/components/ProposalTableRow";
import { SideBar } from "modules/explorer/components/SideBar";
import { TokenHoldersDialog } from "modules/explorer/components/TokenHoldersDialog";
import { useDAO } from "services/contracts/baseDAO/hooks/useDAO";
import { useProposals } from "services/contracts/baseDAO/hooks/useProposals";
import { ProposalStatus } from "services/bakingBad/proposals/types";

const StyledContainer = styled(Grid)(({ theme }) => ({
  background: theme.palette.primary.main,
  height: 184,
  paddingTop: "4%",
  boxSizing: "border-box",
}));

const JustifyEndGrid = styled(Grid)({
  textAlign: "end",
});

const PageLayout = styled(Grid)(({ theme }) => ({
  background: theme.palette.primary.main,
  minHeight: "calc(100vh - 102px)",
}));

const MainContainer = styled(Grid)({
  paddingBottom: 0,
  padding: "40px 112px",
  borderBottom: "2px solid #3D3D3D",
});

const StatsBox = styled(Grid)({
  borderRight: "2px solid #3D3D3D",
  width: "unset",
  "&:last-child": {
    borderRight: "none",
  },
});

const NoProposals = styled(Typography)({
  marginTop: 20,
  marginBottom: 20,
});

const StatsContainer = styled(Grid)({
  height: 175,
  borderBottom: "2px solid #3D3D3D",
});

const TokensLocked = styled(StatsBox)({
  padding: "0 50px 0 112px",
});

const LockedTokensBar = styled(LinearProgress)({
  width: "100%",
  "&.MuiLinearProgress-colorSecondary": {
    background: "#3D3D3D",
  },
});

const VotingAddresses = styled(StatsBox)({
  minWidth: 250,
});

const ActiveProposals = styled(StatsBox)({
  paddingLeft: "42px",
});

const TableContainer = styled(Box)({
  width: "100%",
  padding: "72px 112px",
  paddingBottom: 30,
  boxSizing: "border-box",
});

const TableHeader = styled(Grid)({
  borderBottom: "2px solid #3D3D3D",
  paddingBottom: 20,
});

// const ProposalsContainer = styled(Grid)({
//   paddingBottom: 72,
// });

// const UnderlineText = styled(Typography)({
//   textDecoration: "underline",
//   cursor: "pointer",
// });

const ProposalTableHeadText = styled(Typography)({
  fontWeight: "bold",
});

export const Proposals: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: dao } = useDAO(id);

  const name = dao && dao.metadata.unfrozenToken.name;
  const symbol = dao && dao.metadata.unfrozenToken.symbol.toUpperCase();
  const amountLocked = useMemo(() => {
    if (!dao) {
      return 0;
    }

    return dao.ledger.reduce((acc, current) => {
      const frozenBalance = current.balances[1] || 0;
      return acc + frozenBalance;
    }, 0);
  }, [dao]);

  const amountNotLocked = useMemo(() => {
    if (!dao) {
      return 0;
    }

    return dao.ledger.reduce((acc, current) => {
      const frozenBalance = current.balances[0] || 0;
      return acc + frozenBalance;
    }, 0);
  }, [dao]);

  const addressesWithUnfrozenBalance = useMemo(() => {
    if (!dao) {
      return 0;
    }

    return dao.ledger.reduce((acc, current) => {
      const frozenBalance = current.balances[0];
      if (frozenBalance) {
        return acc + 1;
      }

      return acc;
    }, 0);
  }, [dao]);

  const totalTokens = amountLocked + amountNotLocked;

  const amountLockedPercentage = totalTokens
    ? (amountLocked / totalTokens) * 100
    : 0;

  const { data: proposalsData } = useProposals(dao && dao.address);

  const activeProposals = useMemo<ProposalTableRowData[]>(() => {
    if (!proposalsData) {
      return [];
    }

    return proposalsData
      .filter((proposalData) => proposalData.status === ProposalStatus.ACTIVE)
      .map((proposal) =>
        mapProposalData(
          { ...proposal, quorumTreshold: dao?.storage.quorumTreshold || 0 },
          dao?.address
        )
      );
  }, [dao?.address, dao?.storage.quorumTreshold, proposalsData]);

  const passedProposals = useMemo<ProposalTableRowData[]>(() => {
    if (!proposalsData) {
      return [];
    }

    return proposalsData
      .filter((proposalData) => proposalData.status === ProposalStatus.PASSED)
      .map((proposal) =>
        mapProposalData(
          { ...proposal, quorumTreshold: dao?.storage.quorumTreshold || 0 },
          dao?.address
        )
      );
  }, [dao?.address, dao?.storage.quorumTreshold, proposalsData]);

  const allProposals = useMemo(() => {
    if (!proposalsData) {
      return [];
    }

    return proposalsData.map((proposal) =>
      mapProposalData(
        { ...proposal, quorumTreshold: dao?.storage.quorumTreshold || 0 },
        dao?.address
      )
    );
  }, [dao?.address, dao?.storage.quorumTreshold, proposalsData]);

  return (
    <>
      <PageLayout container wrap="nowrap">
        <SideBar />
        <Grid item xs>
          <MainContainer>
            <StyledContainer container direction="row">
              <Grid item xs={6}>
                <Typography variant="subtitle1" color="secondary">
                  {name}
                </Typography>
                <Typography variant="h5" color="textSecondary">
                  Proposals
                </Typography>
              </Grid>
              <JustifyEndGrid item xs={6}>
                <NewProposalDialog />
              </JustifyEndGrid>
            </StyledContainer>
          </MainContainer>
          <StatsContainer container>
            <TokensLocked
              item
              xs={6}
              container
              direction="column"
              alignItems="center"
              justify="center"
            >
              <Grid container justify="space-between" alignItems="center">
                <Grid item>
                  <Box>
                    <Typography variant="subtitle2" color="secondary">
                      {symbol} Locked
                    </Typography>
                  </Box>
                  <Box padding="12px 0">
                    <Typography variant="h3" color="textSecondary">
                      {amountLocked}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item>
                  {dao && <TokenHoldersDialog address={dao?.address} />}
                </Grid>
              </Grid>
              <LockedTokensBar
                variant="determinate"
                value={amountLockedPercentage}
                color="secondary"
              />
            </TokensLocked>
            <VotingAddresses
              item
              container
              direction="column"
              alignItems="center"
              justify="center"
            >
              <Box>
                <Typography variant="subtitle2" color="secondary">
                  Voting Addresses
                </Typography>
                <Typography variant="h3" color="textSecondary">
                  {addressesWithUnfrozenBalance}
                </Typography>
              </Box>
            </VotingAddresses>
            <ActiveProposals
              item
              xs
              container
              direction="column"
              justify="center"
            >
              <Box>
                <Typography variant="subtitle2" color="secondary">
                  Active Proposals
                </Typography>
                <Typography variant="h3" color="textSecondary">
                  {activeProposals?.length}
                </Typography>
              </Box>
            </ActiveProposals>
          </StatsContainer>
          <TableContainer>
            <TableHeader container wrap="nowrap">
              <Grid item xs={5}>
                <ProposalTableHeadText
                  variant="subtitle1"
                  color="textSecondary"
                >
                  ACTIVE PROPOSALS
                </ProposalTableHeadText>
              </Grid>
              <Grid item xs={2}>
                <ProposalTableHeadText
                  variant="subtitle1"
                  color="textSecondary"
                >
                  CYCLE
                </ProposalTableHeadText>
              </Grid>
              <Grid item xs={5}>
                <ProposalTableHeadText
                  variant="subtitle1"
                  color="textSecondary"
                >
                  STATUS
                </ProposalTableHeadText>
              </Grid>
            </TableHeader>
            {activeProposals.map((proposal, i) => (
              <ProposalTableRow key={`proposal-${i}`} {...proposal} />
            ))}
            {activeProposals.length === 0 ? (
              <NoProposals variant="subtitle1" color="textSecondary">
                No active proposals
              </NoProposals>
            ) : null}
          </TableContainer>

          {/* <ProposalsContainer
            container
            direction="row"
            alignItems="center"
            justify="center"
          >
            <UnderlineText
              color="textSecondary"
              variant="subtitle1"
              align="center"
            >
              LOAD MORE
            </UnderlineText>
          </ProposalsContainer> */}

          <TableContainer>
            <TableHeader container wrap="nowrap">
              <Grid item xs={5}>
                <ProposalTableHeadText
                  variant="subtitle1"
                  color="textSecondary"
                >
                  PASSED PROPOSALS
                </ProposalTableHeadText>
              </Grid>
              <Grid item xs={2}>
                <ProposalTableHeadText
                  variant="subtitle1"
                  color="textSecondary"
                >
                  {""}
                </ProposalTableHeadText>
              </Grid>
              <Grid item xs={5}>
                <ProposalTableHeadText
                  variant="subtitle1"
                  color="textSecondary"
                >
                  {""}
                </ProposalTableHeadText>
              </Grid>
            </TableHeader>
            {passedProposals.map((proposal, i) => (
              <ProposalTableRow key={`proposal-${i}`} {...proposal} />
            ))}

            {passedProposals.length === 0 ? (
              <NoProposals variant="subtitle1" color="textSecondary">
                No passed proposals
              </NoProposals>
            ) : null}
          </TableContainer>

          <TableContainer>
            <TableHeader container wrap="nowrap">
              <Grid item xs={5}>
                <ProposalTableHeadText
                  variant="subtitle1"
                  color="textSecondary"
                >
                  ALL PROPOSALS
                </ProposalTableHeadText>
              </Grid>
              <Grid item xs={2}>
                <ProposalTableHeadText
                  variant="subtitle1"
                  color="textSecondary"
                >
                  {""}
                </ProposalTableHeadText>
              </Grid>
              <Grid item xs={5}>
                <ProposalTableHeadText
                  variant="subtitle1"
                  color="textSecondary"
                >
                  {""}
                </ProposalTableHeadText>
              </Grid>
            </TableHeader>
            {allProposals.map((proposal, i) => (
              <ProposalTableRow key={`proposal-${i}`} {...proposal} />
            ))}
          </TableContainer>
        </Grid>
      </PageLayout>
    </>
  );
};
