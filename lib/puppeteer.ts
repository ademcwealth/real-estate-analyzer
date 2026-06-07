// eslint-disable-next-line @typescript-eslint/no-require-imports
const puppeteer = require("puppeteer-core");

const LOCAL_CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const LOCAL_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-blink-features=AutomationControlled",
];

function isServerless(): boolean {
  return !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

// Hosted Chromium binary URL for serverless — set CHROMIUM_REMOTE_EXEC_PATH to override.
// Using chromium-min (no bundled binary) keeps the Vercel function well under the 50 MB limit.
const CHROMIUM_REMOTE_URL =
  process.env.CHROMIUM_REMOTE_EXEC_PATH ??
  "https://github.com/Sparticuz/chromium/releases/download/v147.0.0/chromium-v147.0.0-pack.tar";

export async function launchBrowser() {
  if (isServerless()) {
    const Chromium = (await import("@sparticuz/chromium-min")).default;
    return puppeteer.launch({
      args: Chromium.args,
      executablePath: await Chromium.executablePath(CHROMIUM_REMOTE_URL),
      headless: true,
    });
  }

  return puppeteer.launch({
    executablePath: LOCAL_CHROME,
    headless: true,
    args: LOCAL_ARGS,
  });
}
