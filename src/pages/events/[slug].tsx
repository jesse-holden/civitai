import {
  Alert,
  Anchor,
  Button,
  Card,
  Center,
  Container,
  createStyles,
  Divider,
  Grid,
  Group,
  Image,
  Loader,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  useMantineTheme,
} from '@mantine/core';
import { Currency } from '@prisma/client';
import { IconBolt, IconBulb, IconChevronRight, IconClipboard } from '@tabler/icons-react';
import {
  CategoryScale,
  Chart as ChartJS,
  ChartOptions,
  Tooltip as ChartTooltip,
  LineElement,
  LinearScale,
  PointElement,
} from 'chart.js';
import dayjs from 'dayjs';
import { InferGetServerSidePropsType } from 'next';
import Link from 'next/link';
import { Fragment, forwardRef, useMemo, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { getEdgeUrl } from '~/client-utils/cf-images-utils';
import { NotFound } from '~/components/AppLayout/NotFound';
import { useBuzzTransaction } from '~/components/Buzz/buzz.utils';
import { Countdown } from '~/components/Countdown/Countdown';
import { CurrencyBadge } from '~/components/Currency/CurrencyBadge';
import { CurrencyIcon } from '~/components/Currency/CurrencyIcon';
import { HolidayFrame } from '~/components/Decorations/HolidayFrame';
import { Lightbulb } from '~/components/Decorations/Lightbulb';
import { EdgeMedia } from '~/components/EdgeMedia/EdgeMedia';
import { EventContributors } from '~/components/Events/EventContributors';
import { SectionCard } from '~/components/Events/SectionCard';
import { WelcomeCard } from '~/components/Events/WelcomeCard';
import { useMutateEvent, useQueryEvent } from '~/components/Events/events.utils';
import { HeroCard } from '~/components/HeroCard/HeroCard';
import { JdrfLogo } from '~/components/Logo/JdrfLogo';
import { Meta } from '~/components/Meta/Meta';
import { PageLoader } from '~/components/PageLoader/PageLoader';
import { env } from '~/env/client.mjs';
import { constants } from '~/server/common/constants';
import { eventSchema } from '~/server/schema/event.schema';
import { createServerSideProps } from '~/server/utils/server-side-helpers';
import { formatDate, stripTime } from '~/utils/date-helpers';
import { showErrorNotification } from '~/utils/notifications';
import { abbreviateNumber, numberWithCommas } from '~/utils/number-helpers';
import { NextLink } from '@mantine/next';

export const getServerSideProps = createServerSideProps({
  useSession: true,
  useSSG: true,
  resolver: async ({ ctx, ssg }) => {
    const result = eventSchema.safeParse({ event: ctx.query.slug });
    if (!result.success) return { notFound: true };

    const { event } = result.data;
    if (ssg) {
      await ssg.event.getTeamScores.prefetch({ event });
      await ssg.event.getTeamScoreHistory.prefetch({ event });
      await ssg.event.getCosmetic.prefetch({ event });
      await ssg.event.getData.prefetch({ event });
    }

    return { props: { event } };
  },
});

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip);
const options: ChartOptions<'line'> = {
  responsive: true,
  elements: {
    point: { pointStyle: 'cross' },
  },
  scales: {
    x: { grid: { display: false } },
    y: { grid: { display: false } },
  },
  plugins: {
    legend: { display: false },
    title: { display: false },
  },
};

const resetTime = dayjs().utc().endOf('day').toDate();
const startTime = dayjs().utc().startOf('day').toDate();

const aboutText =
  "Your challenge is to post an image, model or article on a daily basis throughout December. For each day you complete a post, you'll receive a new lightbulb on your garland in the team color randomly assigned to you when you join the challenge. The more bulbs you collect, the more badges you can win! The more Buzz donated to your team bank, the brighter your lights shine. The brighter your lights shine, the bigger your bragging rights. The team with the brightest lights and highest Spirit Bank score wins a shiny new animated badge!";

export default function EventPageDetails({
  event,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { theme, classes, cx } = useStyles();

  const inputRef = useRef<HTMLInputElement>(null);

  const {
    eventData,
    teamScores,
    teamScoresHistory,
    eventCosmetic,
    rewards,
    userRank,
    loading,
    loadingHistory,
    loadingRewards,
    loadingUserRank,
  } = useQueryEvent({ event });

  const userTeam = (eventCosmetic?.cosmetic?.data as { type: string; color: string })?.color;
  const totalTeamScores = teamScores.reduce((acc, teamScore) => acc + teamScore.score, 0);
  const cosmeticData = eventCosmetic?.data as { lights: number; upgradedLights: number };

  const labels = useMemo(
    () =>
      Array.from(
        new Set(
          teamScoresHistory
            .flatMap((teamScore) => teamScore.scores.map((score) => score.date))
            .sort((a, b) => a.getTime() - b.getTime())
            .map((date) => formatDate(stripTime(date), 'MMM-DD'))
        )
      ),
    [teamScoresHistory]
  );

  const updatedTeamScoresHistory = useMemo(
    () =>
      teamScoresHistory.map((teamScore) => {
        let lastMatchedIndex = -1;

        return {
          ...teamScore,
          scores: labels.map((label, index) => {
            const matchedScore = teamScore.scores.find(
              (score) => formatDate(stripTime(score.date), 'MMM-DD') === label
            );

            if (matchedScore) {
              lastMatchedIndex = index;
              return { date: label, score: matchedScore?.score };
            } else {
              return { date: label, score: teamScore.scores[lastMatchedIndex]?.score ?? 0 };
            }
          }),
        };
      }),
    [labels, teamScoresHistory]
  );

  if (loading) return <PageLoader />;
  if (!eventData) return <NotFound />;

  const handleFocusDonateInput = () => inputRef.current?.focus();

  const equipped = eventCosmetic?.obtained && eventCosmetic?.equipped;

  return (
    <>
      <Meta
        title={`${eventData.title} | Civitai`}
        links={[{ href: `${env.NEXT_PUBLIC_BASE_URL}/events/${event}`, rel: 'canonical' }]}
      />
      <Container size="md">
        <Stack spacing={48}>
          <Paper
            radius="md"
            sx={(theme) => ({
              backgroundImage: eventData?.coverImage
                ? `url(${getEdgeUrl(eventData.coverImage, { width: 1600 })})`
                : undefined,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'top',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              aspectRatio: '3',
              overflow: 'hidden',

              [theme.fn.smallerThan('sm')]: {
                aspectRatio: '1',
              },
            })}
          >
            <Stack
              spacing={0}
              pt={60}
              pb="sm"
              px="md"
              sx={{
                width: '100%',
                background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.6))',
              }}
            >
              <Title color="white" className="hide-mobile">
                {eventData?.title}
              </Title>
              <Group spacing="xs" position="apart">
                <Text color="white" size="sm" className="hide-mobile">
                  {formatDate(eventData?.startDate, 'MMMM D, YYYY')} -{' '}
                  {formatDate(eventData?.endDate, 'MMMM D, YYYY')}
                </Text>
                {eventData?.coverImageUser && (
                  <Text color="white" size="xs">
                    Banner created by{' '}
                    <Text
                      component={NextLink}
                      href={`/user/${eventData.coverImageUser}`}
                      td="underline"
                    >
                      {eventData.coverImageUser}
                    </Text>
                  </Text>
                )}
              </Group>
            </Stack>
          </Paper>
          <Stack className="show-mobile" spacing={0} mt={-40}>
            <Title sx={{ fontSize: '28px' }}>{eventData?.title}</Title>
            <Text size="sm">
              {formatDate(eventData?.startDate, 'MMMM D, YYYY')} -{' '}
              {formatDate(eventData?.endDate, 'MMMM D, YYYY')}
            </Text>
          </Stack>
          {!equipped && <WelcomeCard event={event} about={aboutText} />}
          <CharitySection visible={!equipped} />
          <Grid gutter={48}>
            {eventCosmetic?.cosmetic && equipped && (
              <>
                <Grid.Col xs={12} sm="auto">
                  <Card className={classes.card} py="xl" px="lg" radius="lg" h="100%">
                    <HolidayFrame cosmetic={eventCosmetic.cosmetic} data={cosmeticData} />
                    <Stack spacing={0} align="center" mt="lg" mb={theme.spacing.lg * 2}>
                      <Text size="xl" weight={590}>
                        Your Garland
                      </Text>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-end',
                        }}
                      >
                        <Lightbulb color={userTeam} size={48} transform="rotate(180)" />
                        <Text size={80} weight={590} color={userTeam} lh="70px">
                          {cosmeticData.lights ?? 0}
                        </Text>{' '}
                        <Text size={32} weight={590} color="dimmed">
                          / 31
                        </Text>
                      </div>
                    </Stack>
                    {eventCosmetic.available && (
                      <Stack spacing="sm">
                        <Button
                          component={NextLink}
                          href="/posts/create"
                          color="gray"
                          variant="filled"
                          radius="xl"
                          fullWidth
                        >
                          <Group spacing={4} noWrap>
                            <IconBulb size={18} />
                            Earn more lights
                          </Group>
                        </Button>
                        <Button
                          color="gray"
                          variant="filled"
                          radius="xl"
                          onClick={handleFocusDonateInput}
                          fullWidth
                        >
                          <Group spacing={4} noWrap>
                            <IconBolt size={18} />
                            Make them brighter
                          </Group>
                        </Button>
                      </Stack>
                    )}
                  </Card>
                </Grid.Col>
                <Grid.Col xs={12} sm="auto">
                  <Card
                    py="xl"
                    px="lg"
                    radius="lg"
                    h="100%"
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <Stack w="100%">
                      <Stack spacing={0} align="center">
                        <Text size="sm" weight={590}>
                          Total Team Donations
                        </Text>
                        <Group spacing={4} noWrap>
                          <CurrencyIcon currency={Currency.BUZZ} />
                          <Text size={32} weight={590} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {numberWithCommas(totalTeamScores)}
                          </Text>
                        </Group>
                      </Stack>
                      <Stack spacing={8} sx={{ ['&>*']: { flexGrow: 1 } }}>
                        <Group spacing={8} position="apart">
                          <Text size="sm" weight={590}>
                            Team Rank
                          </Text>
                          <Text size="sm" weight={590}>
                            Spirit Bank
                          </Text>
                        </Group>
                        {teamScores.map((teamScore) => {
                          const color = teamScore.team.toLowerCase();
                          const brightness =
                            (teamScores.length - teamScore.rank + 1) / teamScores.length;

                          return (
                            <Fragment key={teamScore.team}>
                              <Group spacing={8} position="apart">
                                <Group spacing={4} noWrap>
                                  <Text size="xl" weight={590}>
                                    {teamScore.rank}
                                  </Text>
                                  <Lightbulb
                                    variant="star"
                                    color={color}
                                    brightness={brightness}
                                    size={32}
                                  />
                                </Group>
                                <Group spacing={4} noWrap>
                                  <CurrencyIcon currency={Currency.BUZZ} />
                                  <Text
                                    size="xl"
                                    weight={590}
                                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                                  >
                                    {numberWithCommas(teamScore.score)}
                                  </Text>
                                </Group>
                              </Group>
                            </Fragment>
                          );
                        })}
                      </Stack>
                      <Text size="xs" color="dimmed">
                        As of {formatDate(startTime, 'MMMM D, YYYY h:mma')}. Refreshes in:{' '}
                        <Countdown endTime={resetTime} />
                      </Text>
                    </Stack>
                  </Card>
                </Grid.Col>
                {/* <Grid.Col xs={12} sm="auto">
                  <Card
                    className={classes.card}
                    py="xl"
                    px="lg"
                    radius="lg"
                    h="100%"
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <Stack align="center" w="100%" spacing="lg">
                      <Lightbulb variant="star" color={userTeam} size={80} />
                      <Stack spacing={4} align="center">
                        <Text size={24} weight={600} align="center" inline>
                          Your rank in {userTeam} team
                        </Text>
                        {loadingUserRank ? (
                          <Loader variant="bars" />
                        ) : (
                          <Text size={96} weight="bold" align="center" color={userTeam} inline>
                            {userRank?.toLocaleString()}
                          </Text>
                        )}
                      </Stack>
                      <Button
                        component={NextLink}
                        href={`/leaderboard/${event}:${userTeam}`}
                        color="gray"
                        radius="xl"
                        fullWidth
                      >
                        <Group spacing={4} noWrap>
                          <IconClipboard size={18} />
                          Team leaderboard
                        </Group>
                      </Button>
                      <Button
                        color="gray"
                        variant="filled"
                        radius="xl"
                        onClick={handleFocusDonateInput}
                        fullWidth
                      >
                        <Group spacing={4} noWrap>
                          <IconBolt size={18} />
                          Boost your rank
                        </Group>
                      </Button>
                    </Stack>
                  </Card>
                </Grid.Col> */}
              </>
            )}
            <Grid.Col span={12}>
              <SectionCard
                title="Spirit Bank History"
                subtitle="See how your team is doing. Have the most Buzz banked at the end to get a shiny new badge!"
              >
                {equipped && <DonateInput event={event} ref={inputRef} />}
                {loadingHistory ? (
                  <Center py="xl">
                    <Loader variant="bars" />
                  </Center>
                ) : (
                  <Stack spacing={40} w="100%" align="center">
                    <Line
                      options={options}
                      data={{
                        labels,
                        datasets: updatedTeamScoresHistory.map(({ team, scores }) => {
                          const color = theme.colors[team.toLowerCase()][theme.fn.primaryShade()];
                          return {
                            label: 'Buzz donated',
                            data: scores.map(({ score }) => score),
                            borderColor: color,
                            backgroundColor: color,
                          };
                        }),
                      }}
                    />
                    <Group spacing="md">
                      {teamScores.length > 0 &&
                        teamScores.map((teamScore) => (
                          <Group key={teamScore.team} spacing={4} noWrap>
                            <ThemeIcon color={teamScore.team.toLowerCase()} radius="xl" size={12}>
                              {null}
                            </ThemeIcon>
                            <Text
                              size="xs"
                              color="dimmed"
                              transform="uppercase"
                              weight={500}
                              lineClamp={1}
                            >
                              {abbreviateNumber(teamScore.score, { decimals: 2 })}
                            </Text>
                          </Group>
                        ))}
                    </Group>
                  </Stack>
                )}
              </SectionCard>
            </Grid.Col>
            <Grid.Col span={12}>
              <SectionCard
                title="Event Rewards"
                subtitle="Earn special badges for completing a variety of challenges during the event."
              >
                {loadingRewards ? (
                  <Center py="xl">
                    <Loader variant="bars" />
                  </Center>
                ) : rewards.length === 0 ? (
                  <Alert color="red" radius="xl" ta="center" w="100%" py={8}>
                    No rewards available
                  </Alert>
                ) : (
                  <SimpleGrid
                    spacing={40}
                    cols={2}
                    breakpoints={[
                      { minWidth: 'sm', cols: 3 },
                      { minWidth: 'md', cols: 5 },
                    ]}
                  >
                    {rewards.map((reward) => (
                      <div key={reward.id}>
                        <div className={classes.badge}>
                          <EdgeMedia src={(reward.data as { url: string })?.url} width="original" />
                        </div>
                        <Text align="center" size="lg" weight={590} w="100%" tt="capitalize">
                          {reward.name}
                        </Text>
                        <Text size="xs" color="dimmed" align="center">
                          {reward.description}
                        </Text>
                      </div>
                    ))}
                  </SimpleGrid>
                )}
              </SectionCard>
            </Grid.Col>
          </Grid>
          <EventContributors event={event} />
          {equipped && (
            <>
              <Divider w="80px" mx="auto" />
              <Stack spacing={20}>
                <Title
                  order={2}
                  align="center"
                  sx={(theme) => ({
                    fontSize: '64px',
                    [theme.fn.smallerThan('sm')]: {
                      fontSize: '28px',
                    },
                  })}
                >
                  About The Challenge
                </Title>
                <Text
                  color="dimmed"
                  sx={(theme) => ({
                    fontSize: '24px',
                    [theme.fn.smallerThan('sm')]: {
                      fontSize: '18px',
                    },
                  })}
                >
                  {aboutText}
                </Text>
              </Stack>
              <CharitySection visible />
            </>
          )}
        </Stack>
      </Container>
    </>
  );
}

const useStyles = createStyles((theme) => ({
  card: {
    background: theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[0],
  },
  badge: {
    width: 96,
    height: 96,
    margin: `0 auto ${theme.spacing.md}px`,
  },
}));

const DonateInput = forwardRef<HTMLInputElement, { event: string }>(({ event }, ref) => {
  const [amount, setAmount] = useState<number>();

  const { conditionalPerformTransaction } = useBuzzTransaction({
    message: (requiredBalance: number) =>
      `You don't have enough funds to perform this action. Required Buzz: ${numberWithCommas(
        requiredBalance
      )}. Buy or earn more buzz to perform this action.`,
    purchaseSuccessMessage: (purchasedBalance) => (
      <Stack>
        <Text>Thank you for your purchase!</Text>
        <Text>
          We have added <CurrencyBadge currency={Currency.BUZZ} unitAmount={purchasedBalance} /> to
          your account and your donation has been sent.
        </Text>
      </Stack>
    ),
    performTransactionOnPurchase: true,
  });

  const { donate, donating } = useMutateEvent();

  const handleSubmit = () => {
    if (!amount || amount <= 0 || amount > constants.buzz.maxTipAmount) return;

    const performTransaction = async () => {
      try {
        await donate({ event, amount });
        setAmount(undefined);
      } catch (e) {
        const error = e as Error;
        showErrorNotification({ title: 'Unable to donate', error });
      }
    };

    conditionalPerformTransaction(amount, performTransaction);
  };

  return (
    <Group spacing={8} noWrap>
      <NumberInput
        ref={ref}
        placeholder="Your donation"
        icon={<CurrencyIcon currency={Currency.BUZZ} size={16} />}
        formatter={numberWithCommas}
        parser={(value?: string) => value && value.replace(/\$\s?|(,*)/g, '')}
        value={amount}
        onChange={setAmount}
        min={1}
        max={constants.buzz.maxTipAmount}
        rightSectionWidth="25%"
        hideControls
      />
      <Button color="yellow.7" loading={donating} onClick={handleSubmit}>
        Donate Buzz
      </Button>
    </Group>
  );
});
DonateInput.displayName = 'DonateInput';

const partners = [
  {
    title: 'RunDiffusion',
    subtitle: 'Matching ⚡500k',
    image: '/images/holiday/partners/rundiffusion.png',
    url: 'https://rundiffusion.com/',
  },
];

const CharitySection = ({ visible }: { visible: boolean }) => {
  const { classes } = useCharityStyles();
  if (!visible) return null;

  return (
    <>
      <HeroCard
        title={<JdrfLogo width={145} height={40} />}
        description="All Buzz purchased and donated to Team Spirit Banks will be given to the global charity, the Juvenile Diabetes Research Foundation."
        imageUrl="https://www.jdrf.org/wp-content/uploads/2023/02/d-b-1-800x474-1.png"
        externalLink="https://www.jdrf.org/"
      />
      <SectionCard
        title="Matching Partners"
        subtitle="Each partner will match the Buzz amount donated by the end of the month."
      >
        <div className={classes.partnerGrid}>
          {partners.map((partner, index) => (
            <a
              key={index}
              className={classes.partner}
              href={partner.url}
              target="_blank"
              rel="noreferrer"
            >
              <Image
                src={partner.image}
                alt={partner.title}
                width={120}
                height={120}
                sx={(theme) => ({ backgroundColor: theme.colors.dark[7], borderRadius: 30 })}
                imageProps={{
                  style: { objectFit: 'cover', objectPosition: 'left', width: 120, height: 120 },
                }}
              />
              <Stack spacing={0} align="center">
                <Text size={20} weight={600}>
                  {partner.title}
                </Text>
                <Text size="xs" color="dimmed">
                  {partner.subtitle}
                </Text>
              </Stack>
            </a>
          ))}
        </div>
        <Group position="center">
          <Button
            component="a"
            size="md"
            variant="light"
            radius="xl"
            sx={{ alignSelf: 'flex-start' }}
            rightIcon={<IconChevronRight />}
            href="/forms/matching-partner"
            target="_blank"
          >
            Become a partner
          </Button>
        </Group>
      </SectionCard>
    </>
  );
};

const useCharityStyles = createStyles((theme) => ({
  partnerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    width: '100%',
    [theme.fn.largerThan('xs')]: {
      gridTemplateColumns: 'repeat(3, 1fr)',
    },
    [theme.fn.largerThan('sm')]: {
      gridTemplateColumns: 'repeat(4, 1fr)',
    },
  },
  partner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none !important',
    color: 'inherit !important',
    gap: theme.spacing.xs,
  },
}));
