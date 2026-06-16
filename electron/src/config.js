// WARYA target URL.
//
// This is the URL the desktop wrapper will load on startup. Override at
// build time via the WARYA_URL env var when running `yarn build:win`, or
// edit this file before tagging a release.
//
// Defaults to the Emergent preview deploy. Replace with your own domain
// once WARYA is deployed to production (e.g. https://pos.yasdynamic.com).
module.exports = {
  WARYA_URL:
    process.env.WARYA_URL ||
    "https://touchpoint-sales-1.preview.emergentagent.com",
};
