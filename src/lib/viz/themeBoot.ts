export const THEME_KEY = "golfnerds-theme";
/** Inline script for <head>: applies the saved theme before first paint (server-safe, no React). */
export const THEME_BOOT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==='light')document.documentElement.dataset.theme='light'}catch(e){}`;
