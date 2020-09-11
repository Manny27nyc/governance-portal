import React, { Fragment } from 'react';
import { connect } from 'react-redux';
import styled, { keyframes } from 'styled-components';
import ReactMarkdown from 'react-markdown';
import { isNil, isEmpty } from 'ramda';
import mixpanel from 'mixpanel-browser';
import { toSlug, formatRound, cutMiddle, eq } from '../utils/misc';
import Button from '../components/Button';
import Card from '../components/Card';
import Loader from '../components/Loader';
import PollingVote from '../components/modals/PollingVote';
import PollingVoteRankedChoice from '../components/modals/PollingVote/RankedChoice';
import NotFound from './NotFound';
import { VotingWeightBanner } from './PollingList';
import { activeCanVote, getActiveVotingFor } from '../reducers/accounts';
import { modalOpen } from '../reducers/modal';
import { getWinningProp } from '../reducers/proposals';
import {
  getOptionVotingFor,
  getOptionVotingForRankedChoice,
  pollDataInit
} from '../reducers/polling';
import theme, { colors } from '../theme';
import { ethScanLink } from '../utils/ethereum';
import { MIN_MKR_PERCENTAGE } from '../utils/constants';
import ExternalLink from '../components/Onboarding/shared/ExternalLink';
import Dropdown from '../components/Dropdown';
import { Tooltip, Text, Card as CardUI } from '@makerdao/ui-components-core';

const riseUp = keyframes`
0% {
  opacity: 0;
  transform: translateY(15px);
}
100% {
  opacity: 1;
  transform: translateY(0);
}
`;

const RiseUp = styled.div`
  animation: ${riseUp} 0.75s forwards;
`;

const ContentWrapper = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const RightPanels = styled.div`
  display: flex;
  flex-direction: column;
  width: 340px;
`;

const VoteSelection = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const BallotTextWapper = styled.div`
  display: flex;
  flex-direction: row;
`;

const DetailsPanelCard = styled(Card)`
  margin-bottom: 29px;
  font-size: ${({ theme }) => theme.fonts.size.medium};
  padding: 14px 20px;
`;

const CardTitle = styled.p`
  font-size: 20px;
  font-weight: 500;
  color: ${theme.text.darker_default};
  line-height: 28px;
  margin-top: 20px;
  margin-bottom: 6px;
`;

const VoteStatusText = styled.p`
  margin-top: 10px;
  margin-bottom: 35px;
  text-align: left;
  line-height: 2;
  font-size: 14px;
`;

const VotingBallotText = styled.p`
  color: #546978;
  font-size: 14px;
  margin-bottom: 10px;
`;

const Black = styled.span`
  color: ${theme.text.default};
`;

const Strong = styled(Black)`
  color: ${theme.text.default};
  font-weight: bold;
`;

const Blue = styled.span`
  color: ${theme.text.blue_link};
  cursor: pointer;
`;

const DetailsItem = styled(Black)`
  display: flex;
  flex-direction: row;
  padding: 8px 0px;
  font-size: 15px;
  border-bottom: 1px solid rgb(${colors['light_grey2']});
  &:last-child {
    border-bottom: none;
  }
`;

const DetailsCardText = styled.p`
  width: 110px;
  color: rgb(${colors['grey']});
  font-size: 15px;
`;

const DropdownText = styled.p`
  text-overflow: ellipsis;
  overflow: hidden;
  width: ${({ width }) => (width ? width : '125px')};
  margin-left: 13px;
  margin-right: 13px;
  color: ${({ color }) => (color ? `rgb(${colors[color]})` : 'black')};
`;

const VoteButton = styled(Button)`
  border: 0px;
  padding: 0px;
`;

const DescriptionCard = styled(Card)`
  margin: 0;
  max-width: 750px;
  padding: 15px 25px 93px 25px;
  color: #546978;
  line-height: 30px;
`;

const DownloadButton = styled(Button)`
  position: absolute;
  bottom: 20px;
`;

const AddChoice = styled.div`
  color: rgb(${colors.green});
  cursor: ${({ disabled }) => (disabled ? '' : 'pointer')};
`;

const TooltopWrapper = styled.div`
  > span {
    height: 22px;
    width: 16px;
  }
  > span:after {
    height: 22px;
    width: 16px;
  }
  > span:before {
    height: 22px;
    width: 16px;
  }
`;

const DetailsCardItem = ({ name, value, component }) => (
  <DetailsItem>
    <DetailsCardText>{name}</DetailsCardText>
    {value ? value : component}
  </DetailsItem>
);

const getTotalVotesForOption = (voteBreakdown, selectedOptionId) => {
  return voteBreakdown[selectedOptionId].mkrSupport;
};

const VotedFor = ({
  voteStateFetching,
  optionVotingFor,
  optionVotingForId,
  modalOpen,
  poll
}) => {
  if (voteStateFetching) {
    return <Loader mt={34} mb={34} color="header" background="background" />;
  }
  const { voteBreakdown, active, pollId } = poll;
  const totalVotes =
    voteBreakdown && (optionVotingForId || optionVotingForId === 0)
      ? getTotalVotesForOption(voteBreakdown, optionVotingForId)
      : null;
  if (optionVotingFor || optionVotingFor === 0)
    return (
      <VoteStatusText>
        <Black>{active ? 'Currently voting: ' : 'Voted for: '}</Black>
        <Strong>{optionVotingFor} </Strong>
        {active && (
          <Fragment>
            <Black>| </Black>
            <Blue
              onClick={() => {
                mixpanel.track('btn-click', {
                  id: 'withdraw',
                  product: 'governance-dashboard',
                  page: 'Polling',
                  section: 'voting-panel'
                });
                modalOpen(PollingVote, {
                  poll: {
                    pollId,
                    alreadyVotingFor: true,
                    totalVotes,
                    selectedOption: optionVotingFor
                  }
                });
              }}
            >
              Withdraw Vote
            </Blue>
          </Fragment>
        )}
      </VoteStatusText>
    );
  else if (!poll.legacyPoll)
    return (
      <VoteStatusText style={{ display: 'flex' }}>
        <Black style={{ margin: 'auto', fontStyle: 'oblique' }}>
          {active ? 'Not currently voting' : 'You did not vote'}
        </Black>
      </VoteStatusText>
    );
  else return null;
};

class VotingPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedOption: undefined
    };
  }

  onDropdownSelect = (value, index) => {
    const selectedOptionId = parseInt(index);
    this.setState({
      selectedOption: value,
      selectedOptionId
    });
    mixpanel.track('input-change', {
      id: 'dropdown-select',
      product: 'governance-dashboard',
      page: 'Polling',
      section: 'voting-panel'
    });
  };

  render() {
    const { poll, activeAccount, optionVotingFor, modalOpen } = this.props;
    const { pollId, options, voteBreakdown } = poll;
    const { selectedOption, selectedOptionId } = this.state;
    const totalVotes =
      voteBreakdown && (selectedOptionId || selectedOptionId === 0)
        ? getTotalVotesForOption(voteBreakdown, selectedOptionId)
        : null;

    const dropdownValue =
      selectedOption !== undefined
        ? selectedOption.toString()
        : optionVotingFor !== undefined
        ? optionVotingFor.toString()
        : 'Please choose...';

    return (
      <React.Fragment>
        <VoteSelection>
          <Dropdown
            color="green"
            items={options}
            renderItem={item => (
              <DropdownText color="green">{item}</DropdownText>
            )}
            renderRowItem={item => <DropdownText>{item}</DropdownText>}
            value={dropdownValue}
            onSelect={this.onDropdownSelect}
            emptyMsg="Not available"
          />
          <VoteButton
            bgColor="green"
            color="white"
            hoverColor="white"
            width="135px"
            disabled={
              !poll.active ||
              !activeAccount ||
              selectedOptionId === undefined ||
              selectedOption === optionVotingFor
            }
            onClick={() => {
              mixpanel.track('btn-click', {
                id: 'vote',
                product: 'governance-dashboard',
                page: 'Polling',
                section: 'voting-panel'
              });
              modalOpen(PollingVote, {
                poll: {
                  pollId,
                  selectedOption,
                  selectedOptionId,
                  totalVotes
                }
              });
            }}
          >
            Vote Now
          </VoteButton>
        </VoteSelection>
      </React.Fragment>
    );
  }
}

class RankedChoiceDropdown extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedOption: undefined
    };
  }

  onDropdownSelect = (value, index) => {
    const selectedOptionId = parseInt(index);
    this.setState({
      selectedOption: value,
      selectedOptionId
    });
    if (this.props.onSelect)
      this.props.onSelect({
        selectedOption: value,
        selectedOptionId
      });
    mixpanel.track('input-change', {
      id: 'dropdown-select-ranked-choice',
      product: 'governance-dashboard',
      page: 'Polling',
      section: 'voting-panel'
    });
  };

  render() {
    const { options, optionVotingFor, choiceNum, selectable } = this.props;
    const { selectedOption } = this.state;

    const dropdownValue = choiceNum =>
      selectedOption !== undefined
        ? selectedOption.toString()
        : optionVotingFor !== undefined
        ? optionVotingFor.toString()
        : this.props.choiceNumText(choiceNum) + ' choice';

    return (
      <div style={{ marginBottom: '6px' }}>
        <Dropdown
          disabled={!selectable}
          color="light_grey2"
          items={options}
          renderItem={item =>
            selectable ? (
              <DropdownText width="225px">{item}</DropdownText>
            ) : (
              <span style={{ display: 'flex' }}>
                <DropdownText width="225px">{item}</DropdownText>
                <span
                  onClick={() => {
                    this.props.close();
                  }}
                  style={{
                    cursor: 'pointer',
                    right: '12px',
                    position: 'absolute',
                    color: '#708390',
                    fontWeight: 'bold'
                  }}
                >
                  ✕
                </span>
              </span>
            )
          }
          renderRowItem={item => (
            <DropdownText width="225px">{item}</DropdownText>
          )}
          value={dropdownValue(choiceNum)}
          onSelect={this.onDropdownSelect}
          emptyMsg="Not available"
          allowEmpty={true}
        />
      </div>
    );
  }
}

class VotingPanelRankedChoice extends React.Component {
  state = {
    ballot: [], // ordered by preference
    optionCount: 1
  };

  render() {
    const choiceNumText = choiceNum =>
      choiceNum === 1
        ? '1st'
        : choiceNum === 2
        ? '2nd'
        : choiceNum === 3
        ? '3rd'
        : choiceNum + 'th';

    const { poll, activeAccount, modalOpen, existingRanking } = this.props;
    const { active } = poll;
    const { pollId, options } = poll;
    const { ballot } = this.state;
    const unchosenOptions = options.filter(
      option => !ballot.map(b => b.selectedOption).includes(option)
    );
    const canAddChoice =
      ballot[this.state.optionCount - 1] && unchosenOptions.length > 0;
    return (
      <React.Fragment>
        {active && (
          <DetailsPanelCard
            style={{ overflow: 'visible', padding: '0px 30px 15px 30px' }}
          >
            <CardTitle>Your Voting Ballot</CardTitle>
            <BallotTextWapper>
              <VotingBallotText>
                This poll uses instant runoff voting.
              </VotingBallotText>
              <TooltopWrapper>
                <Tooltip
                  color="steel"
                  fontSize="m"
                  ml="2xs"
                  content={
                    <CardUI px="m" py="s" bg="white" maxWidth="30rem">
                      <Text.p
                        t="caption"
                        color="darkLavender"
                        lineHeight="normal"
                      >
                        Voters can rank options in order of preference. If no
                        option achieves more than 50% of the vote based on first
                        choices, the option with the fewest number of votes is
                        eliminated and these votes redistributed to these
                        voters’ second choices. This process is repeated until
                        one option achieves a majority.
                      </Text.p>
                    </CardUI>
                  }
                />
              </TooltopWrapper>
            </BallotTextWapper>
            {Array.from({ length: this.state.optionCount }).map((_, i) => (
              <RankedChoiceDropdown
                choiceNumText={choiceNumText}
                close={() =>
                  this.setState(state => {
                    const ballot = state.ballot;
                    ballot.splice(i, 1);
                    const optionCount = state.optionCount - 1;
                    return { optionCount, ballot };
                  })
                }
                selectable={this.state.optionCount - 1 === i}
                choiceNum={i + 1}
                key={ballot[i] ? ballot[i].optionVotingFor : i}
                onSelect={({ selectedOption, selectedOptionId }) => {
                  this.setState(({ ballot }) => {
                    ballot[i] = { selectedOption, selectedOptionId };
                    return { ballot };
                  });
                }}
                optionVotingFor={
                  ballot[i] ? ballot[i].selectedOption : undefined
                }
                options={unchosenOptions}
              />
            ))}
            {unchosenOptions.length > 0 && (
              <AddChoice
                disabled={!canAddChoice}
                onClick={() => {
                  if (canAddChoice) {
                    this.setState(({ optionCount }) => ({
                      optionCount: optionCount + 1
                    }));
                  }
                }}
              >
                + Add another choice
              </AddChoice>
            )}
            <VoteButton
              style={{ margin: '10px 0' }}
              bgColor="green"
              color="white"
              hoverColor="white"
              width="278px"
              disabled={!poll.active || !activeAccount || ballot.length === 0}
              onClick={() => {
                mixpanel.track('btn-click', {
                  id: 'vote',
                  product: 'governance-dashboard',
                  page: 'Polling',
                  section: 'voting-panel'
                });
                modalOpen(PollingVoteRankedChoice, {
                  poll: {
                    pollId,
                    rankings: ballot.map(choice =>
                      options.findIndex(
                        option => option === choice.selectedOption
                      )
                    )
                  }
                });
              }}
            >
              Submit Vote
            </VoteButton>
          </DetailsPanelCard>
        )}

        {existingRanking ? (
          existingRanking.length === 0 ? (
            <div
              style={{
                color: '#546978',
                textAlign: 'center',
                padding: '10px 0 30px'
              }}
            >
              {active ? 'Not currently voting' : 'You did not vote'}
            </div>
          ) : (
            <DetailsPanelCard
              style={{ overflow: 'visible', padding: '0px 30px 15px 30px' }}
            >
              <CardTitle>{active ? 'Current Vote' : 'Voted For'}</CardTitle>
              {existingRanking.map((ranking, i) => (
                <div
                  style={{
                    color: 'rgb(128,128,128)',
                    fontSize: '15px',
                    margin: '5px 0px'
                  }}
                >
                  <span>{choiceNumText(i + 1)} choice</span>
                  <span style={{ margin: '0px 10px' }}>
                    {options[ranking - 1]}
                  </span>
                </div>
              ))}
              {active && (
                <Blue
                  onClick={() => {
                    mixpanel.track('btn-click', {
                      id: 'withdraw',
                      product: 'governance-dashboard',
                      page: 'Polling',
                      section: 'voting-panel'
                    });
                    modalOpen(PollingVoteRankedChoice, {
                      poll: {
                        pollId,
                        withdraw: true
                      }
                    });
                  }}
                >
                  Withdraw Vote
                </Blue>
              )}
            </DetailsPanelCard>
          )
        ) : (
          <Loader mt={34} mb={34} color="header" background="background" />
        )}
      </React.Fragment>
    );
  }
}

const timeLeft = (startDate, endDate, active) => {
  const now = new Date();
  let timeLeft = Math.floor(endDate / 1000) - Math.floor(now / 1000);
  const days = Math.floor(timeLeft / (3600 * 24));
  const Sday = days !== 1 ? 's' : '';
  timeLeft -= days * 3600 * 24;
  const hours = Math.floor(timeLeft / 3600);
  const Shour = hours !== 1 ? 's' : '';
  timeLeft -= hours * 3600;
  const minutes = Math.floor(timeLeft / 60);
  const Sminute = minutes !== 1 ? 's' : '';

  return active
    ? `${days} day${Sday} ${hours} hr${Shour} ${minutes} min${Sminute}`
    : endDate.toLocaleDateString('en-GB', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
      });
};

const downloadRawPollData = (multiHash, rawData) => {
  const element = document.createElement('a');
  const file = new Blob([rawData], { type: 'text/plain' });
  element.href = URL.createObjectURL(file);
  element.download = `${multiHash}.txt`;
  document.body.appendChild(element);
  element.click();
};

class Polling extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activeAccount: this.props.activeAccount,
      voteStateFetching: true
    };
  }

  static getDerivedStateFromProps(newProps, state) {
    /* Replaces componentWillReceiveProps
    https://reactjs.org/blog/2018/03/27/update-on-async-rendering.html#fetching-external-data-when-props-change */

    if (newProps.activeAccount !== state.activeAccount) {
      return { activeAccount: newProps.activeAccount };
    } else return null;
  }

  async componentDidUpdate(prevProps) {
    if (
      this.state.activeAccount !== prevProps.activeAccount ||
      (this.props.poll && prevProps.poll === undefined)
    ) {
      this.props.pollDataInit(this.props.poll);
      this.updateVotedPollOption();
    }
  }

  componentDidMount() {
    if (!!this.props.poll) this.props.pollDataInit(this.props.poll);
    this.updateVotedPollOption();
  }

  updateVotedPollOption = async () => {
    if (!this.props.poll || !this.state.activeAccount) return null;
    const rankedChoice = this.props.poll.vote_type.includes(
      'Ranked Choice IRV'
    );
    if (rankedChoice) {
      await this.props.getOptionVotingForRankedChoice(
        this.state.activeAccount.address,
        this.props.poll.pollId
      );
    } else {
      await this.props.getOptionVotingFor(
        this.state.activeAccount.address,
        this.props.poll.pollId
      );
    }
    this.setState({
      voteStateFetching: false
    });
  };

  validateLink = link => {
    if (!link) return null;
    return link.indexOf('http') === 0 ? link : `https://${link}`;
  };

  render() {
    const { activeAccount, voteStateFetching } = this.state;
    const {
      poll,
      isValidRoute,
      network,
      accountDataFetching,
      modalOpen,
      pollsFetching
    } = this.props;
    if (pollsFetching && !poll)
      return <Loader mt={34} mb={34} color="header" background="background" />;
    if (isNil(poll) || isEmpty(poll) || !isValidRoute) return <NotFound />;
    const {
      vote_type,
      discussion_link,
      rawData,
      multiHash,
      active,
      options,
      optionVotingFor,
      totalVotes,
      winner,
      rankings,
      rounds
    } = poll;
    const optionVotingForName = options[optionVotingFor];

    const winningProposalName = poll.legacyPoll
      ? poll.winningProposal
      : poll.options[poll.winningProposal];

    const numUniqueVoters = poll.numUniqueVoters
      ? poll.numUniqueVoters.toString()
      : '0';

    const timeLeftString = active ? 'Ends In' : 'Ended On';
    const rankedChoice = vote_type.includes('Ranked Choice IRV');

    return (
      <Fragment>
        <VotingWeightBanner
          fetching={accountDataFetching}
          activeAccount={activeAccount}
        />
        <RiseUp>
          <ContentWrapper>
            <DescriptionCard>
              <ReactMarkdown
                className="markdown"
                skipHtml={false}
                source={poll.content}
              />
              {rawData && (
                <DownloadButton
                  onClick={() => downloadRawPollData(multiHash, rawData)}
                >
                  Download raw document
                </DownloadButton>
              )}
            </DescriptionCard>
            <RightPanels>
              {rankedChoice && (
                <VotingPanelRankedChoice
                  existingRanking={rankings}
                  poll={poll}
                  activeAccount={activeAccount}
                  modalOpen={modalOpen}
                  totalVotes={totalVotes}
                />
              )}
              {active && !rankedChoice && (
                <VotingPanel
                  optionVotingFor={optionVotingForName}
                  poll={poll}
                  activeAccount={activeAccount}
                  modalOpen={modalOpen}
                  totalVotes={totalVotes}
                />
              )}
              {rankedChoice ? null : (
                <VotedFor
                  poll={poll}
                  optionVotingFor={optionVotingForName}
                  optionVotingForId={optionVotingFor}
                  voteStateFetching={voteStateFetching || accountDataFetching}
                  withdrawVote={this.withdrawVote}
                  modalOpen={modalOpen}
                  totalVotes={totalVotes}
                  alreadyVotingFor={true}
                />
              )}
              <DetailsPanelCard style={{ padding: '0px 30px 15px 30px' }}>
                <CardTitle>Details</CardTitle>
                {[
                  {
                    name: 'Source',
                    component: (
                      <ExternalLink
                        href={ethScanLink(poll.source, network)}
                        target="_blank"
                      >
                        {cutMiddle(poll.source, 8, 8)}
                      </ExternalLink>
                    )
                  },
                  {
                    name: 'Started',
                    value: poll.startDate.toLocaleDateString('en-GB', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: 'numeric'
                    })
                  },
                  {
                    name: timeLeftString,
                    value: timeLeft(poll.startDate, poll.endDate, active)
                  },
                  {
                    name: 'Questions?',
                    component: (
                      <ExternalLink
                        href="https://community-development.makerdao.com/makerdao-mcd-faqs/faqs/governance"
                        target="_blank"
                      >
                        Governance FAQ's
                      </ExternalLink>
                    )
                  },
                  {
                    name: 'Discussion',
                    component: (
                      <ExternalLink
                        href={this.validateLink(discussion_link)}
                        target="_blank"
                      >
                        Here
                      </ExternalLink>
                    ),
                    hide: !discussion_link
                  }
                ].map((item, i) => {
                  if (!item.hide) return <DetailsCardItem key={i} {...item} />;
                  return null;
                })}

                {poll.legacyPoll ? null : (
                  <>
                    <CardTitle>Voting Stats</CardTitle>
                    {[
                      {
                        name: 'Total votes',
                        value: isNaN(poll.totalVotes)
                          ? '----'
                          : `${formatRound(poll.totalVotes, 2)} MKR`
                      },
                      {
                        name: 'Participation',
                        value: isNaN(poll.participation)
                          ? '----'
                          : parseFloat(poll.participation) <
                              MIN_MKR_PERCENTAGE &&
                            parseFloat(poll.participation) !== 0
                          ? `< ${MIN_MKR_PERCENTAGE}%`
                          : `${formatRound(poll.participation, 2)}%`
                      },
                      {
                        name: 'Unique voters',
                        value: numUniqueVoters
                      }
                    ].map((item, i) => (
                      <DetailsCardItem key={i} {...item} />
                    ))}
                  </>
                )}

                {rankedChoice ? (
                  <div>
                    <CardTitle>Vote breakdown</CardTitle>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'rgb(247, 248, 249)',
                        padding: '6px 14px',
                        borderRadius: '4px',
                        margin: '6px 0px'
                      }}
                    >
                      <div>
                        <span
                          style={{
                            color: '#47495f',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          {active ? 'INSTANT RUNOFF LEADER ' : 'POLL WINNER'}
                        </span>
                        <div style={{ color: 'rgb(71, 73, 95)' }}>
                          {options[parseInt(winner) - 1] ||
                          options[parseInt(winner) - 1] === 0
                            ? options[parseInt(winner) - 1]
                            : null}
                        </div>
                      </div>
                      {active ? (
                        <Tooltip
                          color="steel"
                          fontSize="m"
                          ml="2xs"
                          content={
                            <CardUI px="m" py="s" bg="white" maxWidth="30rem">
                              <Text.p
                                t="caption"
                                color="darkLavender"
                                lineHeight="normal"
                              >
                                According to the instant runoff voting process,
                                this option would win if the poll ended right
                                now.
                              </Text.p>
                            </CardUI>
                          }
                        />
                      ) : (
                        <span style={{ color: '#9fafb9' }}>
                          {rounds} rounds
                        </span>
                      )}
                    </div>
                    <VoteBreakdownRankedChoice poll={poll} />
                  </div>
                ) : (
                  <>
                    <VoteBreakdown poll={poll} />
                    {(winningProposalName || winningProposalName === 0) && (
                      <>
                        <CardTitle>Winning Proposal</CardTitle>
                        <span>{winningProposalName}</span>
                      </>
                    )}{' '}
                  </>
                )}
              </DetailsPanelCard>
            </RightPanels>
          </ContentWrapper>
        </RiseUp>
      </Fragment>
    );
  }
}

function VoteBreakdown({ poll }) {
  const { voteBreakdownFetching, voteBreakdown, options, legacyPoll } = poll;
  if (legacyPoll) return null;
  const voteBreakdownExists = voteBreakdown && voteBreakdown.length > 0;
  return (
    <>
      <CardTitle>Vote breakdown</CardTitle>
      {voteBreakdownFetching ? (
        <Loader mt={34} mb={34} color="header" background="white" />
      ) : voteBreakdownExists ? (
        <>
          {voteBreakdown.map((item, i) => (
            <DetailsCardItem key={i} {...item} />
          ))}
        </>
      ) : (
        <>
          {options.map((_, i) => (
            <DetailsCardItem key={i} {...{ name: options[i], value: '----' }} />
          ))}
        </>
      )}
    </>
  );
}

function VoteBreakdownRankedChoice({ poll }) {
  const { ballotFetching, ballot, options } = poll;

  const ballotExists = ballot && ballot.length !== 0;
  const sortedBallot = ballotExists
    ? ballot
        .map((choiceOb, i) => ({ ...choiceOb, option: options[i] }))
        .sort((a, b) =>
          a.firstChoice.plus(a.transfer).gt(b.firstChoice.plus(b.transfer))
            ? -1
            : 1
        )
    : [];

  return (
    <>
      {ballotFetching || !ballotExists ? (
        <Loader mt={34} mb={34} color="header" background="white" />
      ) : (
        <>
          {sortedBallot.map(
            ({
              winner,
              firstChoice,
              firstPct,
              transferPct,
              transfer,
              option,
              eliminated
            }) => (
              <div key={option} style={{ marginBottom: '12px' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <div>{option}</div>
                  {eliminated && !winner ? (
                    '0 MKR (0%)'
                  ) : (
                    <div>
                      {firstChoice.plus(transfer).toFixed(1)} MKR (
                      {firstPct.plus(transferPct).toFixed(1)}%)
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: 'flex',
                    position: 'relative',
                    height: '6px',
                    borderBottom: '1px solid rgb(223, 223, 223)'
                  }}
                >
                  <Tooltip
                    color="steel"
                    fontSize="m"
                    content={
                      <CardUI px="m" py="s" bg="white" maxWidth="30rem">
                        <Text.h4 fontSize="1.5rem">First choice votes</Text.h4>
                        <Text.p
                          t="caption"
                          color="darkLavender"
                          lineHeight="normal"
                        >
                          {firstChoice.toFixed(1)} MKR ({firstPct.toFixed(1)}
                          %)
                        </Text.p>
                      </CardUI>
                    }
                  >
                    <div
                      style={{
                        position: 'absolute',
                        height: '6px',
                        background: 'rgb(110, 220, 208)',
                        width: `${firstPct.toFixed(1)}%`,
                        zIndex: '2'
                      }}
                    />
                  </Tooltip>
                  {eliminated && !winner ? (
                    <Tooltip
                      color="steel"
                      fontSize="m"
                      content={
                        <CardUI px="m" py="s" bg="white" maxWidth="30rem">
                          <Text.h4 fontSize="1.5rem">Transfer votes</Text.h4>
                          <Text.p
                            t="caption"
                            color="darkLavender"
                            lineHeight="normal"
                          >
                            - {firstChoice.toFixed(1)} MKR (
                            {firstPct.toFixed(1)}
                            %)
                          </Text.p>
                        </CardUI>
                      }
                    >
                      <div
                        style={{
                          position: 'absolute',
                          height: '6px',
                          background: `rgb(${colors['light_grey2']})`,
                          width: `${firstPct.toFixed(1)}%`,
                          zIndex: '3'
                        }}
                      />
                    </Tooltip>
                  ) : (
                    <Tooltip
                      color="steel"
                      fontSize="m"
                      content={
                        <CardUI px="m" py="s" bg="white" maxWidth="30rem">
                          <Text.h4 fontSize="1.5rem">Transfer votes</Text.h4>
                          <Text.p
                            t="caption"
                            color="darkLavender"
                            lineHeight="normal"
                          >
                            + {transfer.toFixed(1)} MKR (
                            {transferPct.toFixed(1)}
                            %)
                          </Text.p>
                        </CardUI>
                      }
                    >
                      <div
                        style={{
                          position: 'absolute',
                          height: '6px',
                          background: 'rgb(182, 237, 231)',
                          width: `${transferPct.plus(firstPct).toFixed(1)}%`,
                          zIndex: '1'
                        }}
                      />
                    </Tooltip>
                  )}
                </div>
              </div>
            )
          )}
        </>
      )}
    </>
  );
}

const reduxProps = (state, { match }) => {
  const { accounts, metamask, polling } = state;
  const { polls, pollsFetching } = polling;
  const { pollSlug } = match.params;

  const poll = polls.find(({ voteId }) => {
    return toSlug(voteId) === pollSlug;
  });
  const isValidRoute = poll && pollSlug;
  const activeAccount = accounts.activeAccount
    ? accounts.allAccounts.find(a => eq(a.address, accounts.activeAccount))
    : null;

  if (poll && poll.legacyPoll) {
    const winningProp = getWinningProp(state, poll.pollId);
    poll.winningProposal = winningProp ? winningProp.title : 'Not applicable';
  }

  return {
    poll,
    pollsFetching,
    activeAccount,
    accountDataFetching: accounts.fetching,
    canVote: activeCanVote({ accounts }),
    votingFor: getActiveVotingFor({ accounts }),
    network: metamask.network,
    isValidRoute
  };
};

export default connect(reduxProps, {
  modalOpen,
  getOptionVotingFor,
  getOptionVotingForRankedChoice,
  pollDataInit
})(Polling);
