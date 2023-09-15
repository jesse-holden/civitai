import {
  Badge,
  Button,
  Container,
  Divider,
  Grid,
  Group,
  Stack,
  Text,
  Title,
  createStyles,
  BadgeProps,
  Tooltip,
  Accordion,
  Center,
  SimpleGrid,
  Paper,
  ActionIcon,
  useMantineTheme,
  Loader,
  ThemeIcon,
  Alert,
} from '@mantine/core';
import { InferGetServerSidePropsType } from 'next';
import React, { useEffect, useMemo } from 'react';
import { z } from 'zod';

import { getEdgeUrl } from '~/client-utils/cf-images-utils';
import { NotFound } from '~/components/AppLayout/NotFound';
import { Meta } from '~/components/Meta/Meta';
import { PageLoader } from '~/components/PageLoader/PageLoader';
import { RenderHtml } from '~/components/RenderHtml/RenderHtml';
import { SensitiveShield } from '~/components/SensitiveShield/SensitiveShield';
import { UserAvatar } from '~/components/UserAvatar/UserAvatar';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { useIsMobile } from '~/hooks/useIsMobile';
import { getFeatureFlags } from '~/server/services/feature-flags.service';
import { createServerSideProps } from '~/server/utils/server-side-helpers';
import { formatDate } from '~/utils/date-helpers';
import { removeEmpty } from '~/utils/object-helpers';
import { trpc } from '~/utils/trpc';
import { isNsfwImage } from '~/server/common/model-helpers';
import { ImageCarousel } from '~/components/Bounty/ImageCarousel';
import { CurrencyBadge } from '~/components/Currency/CurrencyBadge';
import { BountyEngagementType, BountyMode } from '@prisma/client';
import { BountyGetById } from '~/types/router';
import { ShareButton } from '~/components/ShareButton/ShareButton';
import {
  IconAward,
  IconClockHour4,
  IconHeart,
  IconInfoCircle,
  IconMessageCircle2,
  IconShare3,
  IconStar,
  IconTrophy,
  IconViewfinder,
} from '@tabler/icons-react';
import { LoginRedirect } from '~/components/LoginRedirect/LoginRedirect';
import { useRouter } from 'next/router';
import { abbreviateNumber, formatCurrencyForDisplay } from '~/utils/number-helpers';
import {
  getBountyCurrency,
  isMainBenefactor,
  useBountyEngagement,
  useQueryBounty,
} from '~/components/Bounty/bounty.utils';
import { CurrencyConfig } from '~/server/common/constants';
import {
  DescriptionTable,
  Props as DescriptionTableProps,
} from '~/components/DescriptionTable/DescriptionTable';
import { getDisplayName } from '~/utils/string-helpers';
import { AttachmentCard } from '~/components/Article/Detail/AttachmentCard';
import produce from 'immer';
import { showErrorNotification, showSuccessNotification } from '~/utils/notifications';
import { ContentClamp } from '~/components/ContentClamp/ContentClamp';
import { AppLayout } from '~/components/AppLayout/AppLayout';
import { ImageViewer, useImageViewerCtx } from '~/components/ImageViewer/ImageViewer';
import { DaysFromNow } from '~/components/Dates/DaysFromNow';
import { IconBadge } from '~/components/IconBadge/IconBadge';
import { BountyDiscussion } from '~/components/Bounty/BountyDiscussion';
import { NextLink } from '@mantine/next';
import { CurrencyIcon } from '~/components/Currency/CurrencyIcon';
import { BountyEntryCard } from '~/components/Cards/BountyEntryCard';
import HoverActionButton from '~/components/Cards/components/HoverActionButton';
import { openConfirmModal } from '@mantine/modals';
import { AwardBountyAction } from '~/components/Bounty/AwardBountyAction';
import { BountyContextMenu } from '~/components/Bounty/BountyContextMenu';
import { Collection } from '~/components/Collection/Collection';

const querySchema = z.object({
  id: z.coerce.number(),
  slug: z.array(z.string()).optional(),
});

export const getServerSideProps = createServerSideProps({
  useSSG: true,
  useSession: true,
  resolver: async ({ ctx, ssg, session }) => {
    const features = getFeatureFlags({ user: session?.user });
    if (!features.bounties) return { notFound: true };

    const result = querySchema.safeParse(ctx.query);
    if (!result.success) return { notFound: true };

    if (ssg) await ssg.bounty.getById.prefetch({ id: result.data.id });

    return { props: removeEmpty(result.data) };
  },
});

export default function BountyDetailsPage({
  id,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const currentUser = useCurrentUser();
  const { classes, theme } = useStyles();
  const mobile = useIsMobile();
  const { bounty, loading } = useQueryBounty({ id });
  const [mainImage] = bounty?.images ?? [];
  // Set no images initially, as this might be used by the entries and bounty page too.
  const { setImages, onSetImage } = useImageViewerCtx();
  const totalUnitAmount = useMemo(() => {
    if (!bounty) {
      return 0;
    }

    return bounty.benefactors.reduce((acc, benefactor) => {
      return acc + (benefactor.unitAmount || 0);
    }, 0);
  }, [bounty]);

  const currency = getBountyCurrency(bounty);

  const meta = (
    <Meta
      title={`Civitai | ${bounty?.name}`}
      image={
        !mainImage || isNsfwImage(mainImage) || bounty?.nsfw
          ? undefined
          : getEdgeUrl(mainImage.url, { width: 1200 })
      }
      description={bounty?.description}
    />
  );

  useEffect(() => {
    if (bounty?.id) {
      setImages(bounty.images);
    }
  }, [bounty?.id, bounty?.images, setImages]);

  if (loading) return <PageLoader />;
  if (!bounty) return <NotFound />;

  if ((bounty.nsfw || isNsfwImage(mainImage)) && !currentUser) {
    return (
      <>
        {meta}
        <SensitiveShield />
      </>
    );
  }

  const defaultBadgeProps: BadgeProps = {
    variant: theme.colorScheme === 'dark' ? 'filled' : 'light',
    radius: 'xl',
    px: 'sm',
    size: 'md',
    color: 'gray',
  };

  const expired = bounty.expiresAt < new Date();

  return (
    <>
      {meta}
      <Container size="xl">
        <Stack spacing={8} mb="xl">
          <Group position="apart" className={classes.titleWrapper} noWrap>
            <Group spacing="xs">
              <Title weight="bold" className={classes.title} mr={14} lineClamp={2}>
                {bounty.name}
              </Title>
              {bounty.complete && (
                <Tooltip
                  label="This bounty has been completed and entries have been awarded"
                  maw={250}
                  multiline
                  withArrow
                  withinPortal
                >
                  <ThemeIcon color="yellow.7" radius="xl" variant="light">
                    <IconTrophy size={16} fill="currentColor" />
                  </ThemeIcon>
                </Tooltip>
              )}
              <CurrencyBadge
                {...defaultBadgeProps}
                currency={currency}
                unitAmount={totalUnitAmount}
              />
              {expired ? (
                <Badge {...defaultBadgeProps} color="red" variant="filled" radius="xl">
                  Expired
                </Badge>
              ) : (
                <IconBadge
                  {...defaultBadgeProps}
                  icon={<IconClockHour4 size={14} />}
                  style={{ color: theme.colors.success[5] }}
                >
                  <DaysFromNow date={bounty.expiresAt} withoutSuffix />
                </IconBadge>
              )}
            </Group>
            <BountyContextMenu bounty={bounty} position="bottom-end" />
          </Group>
          <Group spacing={8}>
            <UserAvatar user={bounty.user} withUsername linkToProfile />
            <Divider orientation="vertical" />
            <Text color="dimmed" size="sm">
              {formatDate(bounty.startsAt)}
            </Text>
            {bounty.stats && (
              <>
                <Divider orientation="vertical" />
                <IconBadge {...defaultBadgeProps} icon={<IconViewfinder size={14} />}>
                  {abbreviateNumber(bounty.stats.trackCountAllTime)}
                </IconBadge>
                <IconBadge {...defaultBadgeProps} icon={<IconHeart size={14} />}>
                  {abbreviateNumber(bounty.stats.favoriteCountAllTime)}
                </IconBadge>
                <IconBadge {...defaultBadgeProps} icon={<IconMessageCircle2 size={14} />}>
                  {abbreviateNumber(bounty.stats.commentCountAllTime)}
                </IconBadge>
              </>
            )}
          </Group>
        </Stack>
        <Grid gutterMd={32} gutterLg={64}>
          <Grid.Col xs={12} md={4} orderMd={2}>
            <BountySidebar bounty={bounty} />
          </Grid.Col>
          <Grid.Col xs={12} md={8} orderMd={1}>
            <Stack spacing="xs">
              <ImageCarousel
                images={bounty.images}
                nsfw={bounty.nsfw}
                entityId={bounty.id}
                entityType="bounty"
                mobile={mobile}
                onClick={(image) => {
                  onSetImage(image.id);
                }}
              />
              <Title order={2} mt="sm">
                About this bounty
              </Title>
              <article>
                <Stack spacing={4}>
                  {bounty.description && (
                    <ContentClamp maxHeight={200}>
                      <RenderHtml html={bounty.description} />
                    </ContentClamp>
                  )}
                </Stack>
              </article>
            </Stack>
          </Grid.Col>
        </Grid>
        <BountyEntries bounty={bounty} />
        <Stack spacing="xl" py={32}>
          <Group position="apart">
            <Title order={2} size={28} weight={600}>
              Discussion
            </Title>
          </Group>
          <BountyDiscussion bountyId={bounty.id} userId={bounty.user?.id} />
        </Stack>
      </Container>
    </>
  );
}

const BountySidebar = ({ bounty }: { bounty: BountyGetById }) => {
  const { theme } = useStyles();
  const router = useRouter();
  const queryUtils = trpc.useContext();
  const currentUser = useCurrentUser();
  const benefactor = bounty.benefactors.find((b) => b.user.id === currentUser?.id);
  const expired = bounty.expiresAt < new Date();

  const { data: entries, isLoading: loadingEntries } = trpc.bounty.getEntries.useQuery({
    id: bounty.id,
  });

  const addToBountyEnabled =
    !expired &&
    !bounty.complete &&
    !benefactor?.awardedToId &&
    (bounty.mode !== BountyMode.Individual || isMainBenefactor(bounty, currentUser));
  const { isLoading, mutate: addBenefactorUnitAmountMutation } =
    trpc.bounty.addBenefactorUnitAmount.useMutation({
      onMutate: async ({ unitAmount }) => {
        await queryUtils.bounty.getById.cancel();
        queryUtils.bounty.getById.setData(
          { id: bounty.id },
          produce((bounty) => {
            if (!bounty || !currentUser) {
              return;
            }

            if (isBenefactor) {
              // Update the benefactor:
              bounty.benefactors = bounty.benefactors.map((b) => {
                if (b.user.id === currentUser?.id) {
                  return { ...b, unitAmount: b.unitAmount + unitAmount };
                }

                return b;
              });
            } else {
              // No need to do anything, as the benefactor will be added to the list
              // on invalidate
            }
          })
        );
      },
      onSuccess: (_, { unitAmount }) => {
        showSuccessNotification({
          title: isBenefactor
            ? 'Your contribution has increased!'
            : 'You have been added as a supporter to the bounty!',
          message: `The amount of ${formatCurrencyForDisplay(
            unitAmount,
            currency
          )} ${currency} has been added to the bounty`,
        });
      },
      onError: (error) => {
        showErrorNotification({
          title: 'There was an error adding to the bounty.',
          error: new Error(error.message),
        });
      },
      onSettled: async () => {
        await queryUtils.bounty.getById.invalidate({ id: bounty.id });
      },
    });

  const isBenefactor = useMemo(() => {
    if (!bounty || !currentUser) {
      return false;
    }

    return bounty.benefactors.some((b) => b.user.id === currentUser.id);
  }, [bounty, currentUser]);
  const currency = getBountyCurrency(bounty);

  const minUnitAmount = bounty.minBenefactorUnitAmount;

  const { toggle, engagements, toggling } = useBountyEngagement({ bountyId: bounty.id });

  const isFavorite = !!engagements?.Favorite?.find((id) => id === bounty.id);
  const isTracked = !!engagements?.Track?.find((id) => id === bounty.id);
  const handleEngagementClick = async (type: BountyEngagementType) => {
    if (toggling) return;
    await toggle({ type, bountyId: bounty.id });
  };

  const onAddToBounty = (amount: number) => {
    addBenefactorUnitAmountMutation({ bountyId: bounty.id, unitAmount: amount });
  };

  const meta = bounty.details;

  const bountyDetails: DescriptionTableProps['items'] = [
    {
      label: 'Bounty Type',
      value: (
        <Badge radius="xl" color="gray">
          {getDisplayName(bounty.type)}
        </Badge>
      ),
    },
    {
      label: 'Base Model',
      value: (
        <Badge radius="xl" color="gray">
          {meta?.baseModel}
        </Badge>
      ),
      visible: !!meta?.baseModel,
    },
    {
      label: 'Model Preferences',
      value: (
        <Group spacing={8}>
          {meta?.modelFormat && (
            <Badge radius="xl" color="gray">
              {meta?.modelFormat}
            </Badge>
          )}
          {meta?.modelSize && (
            <Badge radius="xl" color="gray">
              {meta?.modelSize}
            </Badge>
          )}
        </Group>
      ),
      visible: !!meta?.modelFormat || !!meta?.modelSize,
    },
    {
      label: 'Bounty Mode',
      value: (
        <Badge radius="xl" color="gray">
          {getDisplayName(bounty.mode)}
        </Badge>
      ),
    },
    {
      label: 'Date started',
      value: <Text>{formatDate(bounty.startsAt)}</Text>,
    },
    {
      label: 'Deadline',
      value: <Text>{formatDate(bounty.expiresAt)}</Text>,
    },
    {
      label: 'Tags',
      value: (
        <Collection
          items={bounty.tags}
          limit={3}
          renderItem={(tag) => (
            <Badge radius="xl">
              <Text transform="capitalize">{tag.name}</Text>
            </Badge>
          )}
          grouped
        />
      ),
      visible: !!bounty.tags?.length,
    },
  ];

  const benefactorDetails: DescriptionTableProps['items'] = bounty.benefactors.map((b) => ({
    label: (
      <Group spacing={4}>
        <UserAvatar user={b.user} withUsername linkToProfile />
        {isMainBenefactor(bounty, b.user) && (
          <IconStar
            color={CurrencyConfig[currency].color(theme)}
            fill={CurrencyConfig[currency].color(theme)}
            size={12}
          />
        )}
        {b.awardedToId && (
          <Tooltip label={'This supporter has already awarded an entry'}>
            <IconTrophy
              color={CurrencyConfig[currency].color(theme)}
              fill={CurrencyConfig[currency].color(theme)}
              size={12}
            />
          </Tooltip>
        )}
      </Group>
    ),
    value: (
      <Group spacing={4} style={{ float: 'right' }}>
        <CurrencyIcon currency={currency} size={20} />
        <Text weight={590} td={b.awardedToId ? 'line-through' : undefined}>
          {formatCurrencyForDisplay(b.unitAmount, currency)}
        </Text>
      </Group>
    ),
  }));

  const files = bounty.files ?? [];
  const filesCount = files.length;

  return (
    <Stack spacing="md">
      <Group spacing={8}>
        {addToBountyEnabled && (
          <Group
            color="gray"
            position="apart"
            p={4}
            sx={{
              background:
                theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[1],
              flexGrow: 1,
            }}
            noWrap
          >
            <Group spacing={2}>
              <CurrencyIcon currency={currency} size={20} />

              <Text weight={590}>{formatCurrencyForDisplay(minUnitAmount, currency)}</Text>
            </Group>
            <Button
              variant="filled"
              disabled={isLoading}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                openConfirmModal({
                  title: isBenefactor ? 'Add to bounty' : 'Become a supporter',
                  children: (
                    <Stack spacing={0}>
                      <Text size="sm">
                        Are you sure you want{' '}
                        {isBenefactor ? 'add' : 'become a supporter by adding'}{' '}
                        <Text component="span" weight={590}>
                          <CurrencyIcon currency={currency} size={16} />{' '}
                          {formatCurrencyForDisplay(minUnitAmount, currency)}
                        </Text>{' '}
                        to this bounty?
                      </Text>
                      <Text color="red.4" size="sm">
                        This action is non refundable.
                      </Text>

                      {!isBenefactor && (
                        <Text size="sm" mt="sm">
                          <strong>Note:</strong> As a supporter, you will be <strong>unable</strong>{' '}
                          to add entries to this bounty
                        </Text>
                      )}
                    </Stack>
                  ),
                  centered: true,
                  labels: { confirm: 'Confirm', cancel: 'No, go back' },
                  onConfirm: () => {
                    onAddToBounty(minUnitAmount);
                  },
                });
              }}
            >
              {isLoading ? 'Processing...' : isBenefactor ? 'Add to bounty' : 'Become a supporter'}
            </Button>
          </Group>
        )}
        {bounty.complete && !loadingEntries && (
          <Alert color="yellow">
            {(entries?.length ?? 0) > 0 ? (
              <Group spacing={8} align="center" noWrap>
                <ThemeIcon color="yellow.7" variant="light">
                  <IconTrophy size={20} fill="currentColor" />
                </ThemeIcon>
                <Text>
                  This bounty has been completed and prizes have been awarded to the winners
                </Text>
              </Group>
            ) : (
              <Text>
                This bounty has been marked as completed with no entries. All benefactors have been
                refunded.
              </Text>
            )}
          </Alert>
        )}
        <Group spacing={8} noWrap>
          <Tooltip label={isTracked ? 'Stop tracking' : 'Track'} position="top">
            <div>
              <LoginRedirect reason="perform-action">
                <ActionIcon
                  size={42}
                  onClick={() => handleEngagementClick('Track')}
                  color={isTracked ? 'green' : theme.colorScheme === 'dark' ? 'dark.6' : 'gray.1'}
                  variant="filled"
                >
                  <IconViewfinder
                    size={20}
                    color={theme.colorScheme === 'light' ? theme.black : 'currentColor'}
                  />
                </ActionIcon>
              </LoginRedirect>
            </div>
          </Tooltip>
          <Tooltip label={isFavorite ? 'Unlike' : 'Like'} position="top">
            <div>
              <LoginRedirect reason="perform-action">
                <ActionIcon
                  size={42}
                  onClick={() => handleEngagementClick('Favorite')}
                  color={isFavorite ? 'red' : theme.colorScheme === 'dark' ? 'dark.6' : 'gray.1'}
                  variant="filled"
                >
                  <IconHeart
                    size={20}
                    color={theme.colorScheme === 'light' ? theme.black : 'currentColor'}
                  />
                </ActionIcon>
              </LoginRedirect>
            </div>
          </Tooltip>
          <Tooltip label="Share" position="top">
            <div style={{ marginLeft: 'auto' }}>
              <ShareButton url={router.asPath} title={bounty.name}>
                <ActionIcon
                  size={42}
                  color={theme.colorScheme === 'dark' ? 'dark.6' : 'gray.1'}
                  variant="filled"
                >
                  <IconShare3
                    size={20}
                    color={theme.colorScheme === 'light' ? theme.black : 'currentColor'}
                  />
                </ActionIcon>
              </ShareButton>
            </div>
          </Tooltip>
        </Group>
      </Group>

      <Accordion
        variant="separated"
        multiple
        defaultValue={['details']}
        styles={(theme) => ({
          content: { padding: 0 },
          item: {
            overflow: 'hidden',
            borderColor: theme.colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3],
            boxShadow: theme.shadows.sm,
          },
          control: {
            padding: theme.spacing.sm,
          },
        })}
      >
        <Accordion.Item value="details">
          <Accordion.Control>
            <Group position="apart">Overview</Group>
          </Accordion.Control>
          <Accordion.Panel>
            <DescriptionTable
              items={bountyDetails}
              labelWidth="30%"
              withBorder
              paperProps={{
                sx: {
                  borderLeft: 0,
                  borderRight: 0,
                  borderBottom: 0,
                },
                radius: 0,
              }}
            />
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="benefactors">
          <Accordion.Control>
            <Group position="apart">Supporters</Group>
          </Accordion.Control>
          <Accordion.Panel>
            <DescriptionTable
              items={benefactorDetails}
              labelWidth="70%"
              withBorder
              paperProps={{
                sx: {
                  borderLeft: 0,
                  borderRight: 0,
                  borderBottom: 0,
                },
                radius: 0,
              }}
            />
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item
          value="files"
          sx={(theme) => ({
            marginTop: theme.spacing.md,
            marginBottom: theme.spacing.md,
            borderColor: !filesCount ? `${theme.colors.red[4]} !important` : undefined,
          })}
        >
          <Accordion.Control>
            <Group position="apart">
              {filesCount ? `${filesCount === 1 ? '1 File' : `${filesCount} Files`}` : 'Files'}
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack spacing={2}>
              {filesCount > 0 ? (
                <SimpleGrid cols={1} spacing={2}>
                  {files.map((file) => (
                    <AttachmentCard key={file.id} {...file} />
                  ))}
                </SimpleGrid>
              ) : (
                <Center p="xl">
                  <Text size="md" color="dimmed">
                    No files were provided for this bounty
                  </Text>
                </Center>
              )}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
};

const useStyles = createStyles((theme) => ({
  titleWrapper: {
    gap: theme.spacing.xs,

    [theme.fn.smallerThan('md')]: {
      gap: theme.spacing.xs * 0.4,
      alignItems: 'flex-start',
    },
  },

  title: {
    wordBreak: 'break-word',
    [theme.fn.smallerThan('md')]: {
      fontSize: theme.fontSizes.xs * 2.4, // 24px
      width: '100%',
      paddingBottom: 0,
    },
  },
}));

const BountyEntries = ({ bounty }: { bounty: BountyGetById }) => {
  const theme = useMantineTheme();
  const entryCreateUrl = `/bounties/${bounty.id}/entries/create`;
  const { data: entries, isLoading } = trpc.bounty.getEntries.useQuery({ id: bounty.id });
  const { data: ownedEntries = [], isLoading: isLoadingOwnedEntries } =
    trpc.bounty.getEntries.useQuery({
      id: bounty.id,
      owned: true,
    });
  const currentUser = useCurrentUser();
  const currency = getBountyCurrency(bounty);
  const benefactorItem = !currentUser
    ? null
    : bounty.benefactors.find((b) => b.user.id === currentUser.id);
  const expired = bounty.expiresAt < new Date();
  const displaySubmitAction =
    !benefactorItem &&
    !isLoadingOwnedEntries &&
    ownedEntries.length < bounty.entryLimit &&
    !currentUser?.muted &&
    !bounty.complete &&
    !expired;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Stack spacing="xl" py={32}>
      <Group position="apart">
        <Title order={2} size={28} weight={600}>
          Hunters
        </Title>
        <Group>
          <Tooltip label={`Max entries per user: ${bounty.entryLimit}`}>
            <IconInfoCircle color="white" strokeWidth={2.5} size={18} />
          </Tooltip>
          {displaySubmitAction && (
            <Button component={NextLink} href={entryCreateUrl} size="xs">
              Submit
            </Button>
          )}
        </Group>
      </Group>
      {children}
    </Stack>
  );

  if (isLoading) {
    return (
      <Wrapper>
        <Center>
          <Loader />
        </Center>
      </Wrapper>
    );
  }

  if (!entries?.length) {
    return (
      <Wrapper>
        <Paper
          p="xl"
          radius="sm"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: theme.colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.gray[1],
          }}
        >
          <Stack spacing="sm" align="center">
            <Text size={24} weight={600} align="center">
              No submissions yet
            </Text>
            <Text color="dimmed" align="center">
              Be the first to submit your solution.
            </Text>
            {displaySubmitAction && (
              <Button component={NextLink} href={entryCreateUrl} size="sm" w="75%">
                Submit
              </Button>
            )}
          </Stack>
        </Paper>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <SimpleGrid
        spacing="sm"
        breakpoints={[
          { minWidth: 'xs', cols: 1 },
          { minWidth: 'sm', cols: 2 },
          { minWidth: 'md', cols: 4 },
        ]}
        style={{ width: '100%' }}
      >
        {entries.map((entry) => (
          <BountyEntryCard
            key={entry.id}
            data={entry}
            currency={currency}
            renderActions={() => {
              return (
                <>
                  <AwardBountyAction
                    bounty={bounty}
                    bountyEntryId={entry.id}
                    fileUnlockAmount={entry.fileUnlockAmount}
                  >
                    {({ onClick }) => (
                      <HoverActionButton
                        label="Award"
                        size={30}
                        color="yellow.7"
                        variant="filled"
                        onClick={onClick}
                        keepIconOnHover
                      >
                        <IconAward stroke={2.5} size={16} />
                      </HoverActionButton>
                    )}
                  </AwardBountyAction>
                  {benefactorItem && benefactorItem.awardedToId === entry.id && (
                    <Tooltip label="You awarded this entry">
                      <ThemeIcon color={'yellow.7'} radius="xl" size={30} variant={'filled'}>
                        <IconTrophy size={16} stroke={2.5} />
                      </ThemeIcon>
                    </Tooltip>
                  )}
                </>
              );
            }}
          />
        ))}
      </SimpleGrid>
    </Wrapper>
  );
};

BountyDetailsPage.getLayout = function getLayout(page: React.ReactNode) {
  return (
    <ImageViewer>
      <AppLayout>{page}</AppLayout>
    </ImageViewer>
  );
};
