import axios, { AxiosRequestConfig } from 'axios';
import { logger as defaultLogger } from './logging';
import * as slack from './slack';

export interface PRDetectorConfig {
  bitbucketOrg: string;
  bitbucketRepo: string;
  bitbucketUsername: string;
  bitbucketPassword: string;
  bitbucketPRQuery?: string;
  slackWebhookUrl?: string;
  slackAuthor?: string;
  slackAlertTitle?: string;
  detectPath?: string;
  detectionFilter?: (
    config: PRDetectorConfig,
    pr: any,
    diffStats: any[]
  ) => boolean;
  checkPRSeenAsync?: (
    config: PRDetectorConfig,
    input: PRSeenInput
  ) => Promise<boolean>;
  savePRSeenAsync?: (
    config: PRDetectorConfig,
    input: PRSaveInput
  ) => Promise<void>;
  processPRAsync?: (config: PRDetectorConfig, pr: any) => Promise<void>;
  logger?: any;
}

interface PRSeenInput {
  prNumber: string;
}

interface PRSaveInput extends PRSeenInput {
  seen: number;
}

export async function processPullRequestsAsync(
  config: PRDetectorConfig
): Promise<void> {
  if (!config.logger) {
    config.logger = defaultLogger;
  }
  if (config.slackWebhookUrl) {
    slack.init(config.slackWebhookUrl);
  }

  const {
    checkPRSeenAsync = defaultCheckPRSeenAsync,
    savePRSeenAsync = defaultSavePRSeenAsync,
    detectionFilter = defaultDetectionFilter,
    processPRAsync = defaultProcessPRAsync,
    bitbucketPRQuery = 'pullrequests?state=OPEN'
  } = config;

  const prs = await gatherAPIValues(config, config.bitbucketPRQuery);

  debugLog(config, `found ${prs.length} open pull requests`);

  // filter for previously unseen PRs that satisfy detection criteria
  const newRFCs: any = [];

  for (const pr of prs) {
    if (!(await checkPRSeenAsync(config, { prNumber: pr.id }))) {
      debugLog(config, `pr ${pr.id} seems new...`);
      const dstHash = pr.destination.commit.hash;
      const srcHash = pr.source.commit.hash;
      const diffStats = await gatherAPIValues(
        config,
        `diffstat/${dstHash}..${srcHash}`
      );
      if (detectionFilter(config, pr, diffStats)) {
        debugLog(config, `pr ${pr.id} modified an RFC...`);
        newRFCs.push(pr);
      }
      await savePRSeenAsync(config, {
        prNumber: pr.id,
        seen: Math.floor((new Date() as any) / 1000),
      });
      debugLog(config, `cached ${pr.id} as seen...`);
    }
  }

  for (const pr of newRFCs) {
    if (config.slackWebhookUrl) {
      await notifyViaSlack(config, pr);
    }
    await processPRAsync(config, pr);
  }
}

async function gatherAPIValues(
  config: PRDetectorConfig,
  apiUrl: string
): Promise<any[]> {
  const BB_API_V2_BASE = `https://api.bitbucket.org/2.0/repositories/${config.bitbucketOrg}/${config.bitbucketRepo}`;
  const bbReqAuth: AxiosRequestConfig = {
    auth: {
      username: config.bitbucketUsername,
      password: config.bitbucketPassword,
    },
  };

  let prs: any = [];
  let url = `${BB_API_V2_BASE}/${apiUrl}`;
  let res;

  // gather possibly paginated data for bitbucket API values
  do {
    res = await axios.get(url, bbReqAuth);
    prs = prs.concat(res.data.values);
    url = res.data.next;
  } while (url);

  return prs;
}

async function defaultCheckPRSeenAsync(
  config: PRDetectorConfig,
  input: PRSeenInput
): Promise<boolean> {
  config.logger.error('You should implement and configure this function');
  return false;
}

async function defaultSavePRSeenAsync(
  config: PRDetectorConfig,
  input: PRSaveInput
): Promise<void> {
  config.logger.error('You should implement and configure this function');
  return;
}

async function defaultProcessPRAsync(
  config: PRDetectorConfig,
  pr: any
): Promise<void> {
  return;
}

function defaultDetectionFilter(
  config: PRDetectorConfig,
  pr: any,
  diffStats: any[]
): boolean {
  if (!config.detectPath) {
    throw new Error(
      'you must configure the detectPath attribute when using the default detection filter'
    );
  }
  return diffStats.some(
    (i: any) => ((i.new || {}).path || '').indexOf(config.detectPath) !== -1
  );
}

async function notifyViaSlack(
  config: PRDetectorConfig,
  pr: any
): Promise<void> {
  debugLog(config, `alerting slack for ${pr.id}: ${pr.title}`);
  await slack.send({
    author: pr.author.display_name,
    title: pr.title,
    titleLink: pr.links.html.href,
    source: config.slackAuthor,
    alertTitle: config.slackAlertTitle,
  });
}

function debugLog(config: PRDetectorConfig, msg: string) {
  if (process.env.DEBUG) {
    config.logger.info(msg);
  }
}
