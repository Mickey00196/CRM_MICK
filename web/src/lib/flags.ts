// Server features the UI adapts to, read once from /api/me.
let ai = false;
export const setAiEnabled = (on: boolean) => {
  ai = on;
};
/** True when the server has an AI key, so new accounts get looked up from their website. */
export const aiEnabled = () => ai;
