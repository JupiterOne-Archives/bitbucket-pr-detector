/* eslint security/detect-object-injection: 0 */
const SlackWebhook = require('slack-webhook');
let slack: any;

export function init(webhookUrl: string) {
  slack = new SlackWebhook(webhookUrl);
}

export async function send(options: any) {
  const {
    author,
    source,
    title,
    titleLink,
    text,
    alertTitle,
    timestamp,
  } = options;

  const body = {
    author_name: source || 'bitbucket-pr-detector',
    title: title || '',
    title_link: titleLink || '',
    text: text || '',
    fields: [
      {
        title: 'Author',
        title_link: titleLink || '',
        value: author,
        short: true,
      },
    ],
    ts: Math.round((timestamp || new Date()) / 1000),
  };

  await slack.send({
    text: alertTitle,
    attachments: [body],
  });
}
