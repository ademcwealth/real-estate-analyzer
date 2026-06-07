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

export async function launchBrowser() {
  if (isServerless()) {
    // @sparticuz/chromium v147+ — only exports args (static getter) and executablePath()
    const Chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: Chromium.args,
      executablePath: await Chromium.executablePath(),
      headless: true,
    });
  }

  return puppeteer.launch({
    executablePath: LOCAL_CHROME,
    headless: true,
    args: LOCAL_ARGS,
  });
}
