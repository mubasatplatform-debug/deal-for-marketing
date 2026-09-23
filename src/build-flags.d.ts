/**
 * Build-time constants injected by `define` in vite.config.ts.
 *
 * `__DEAL_STANDALONE__` is true only for DEAL_STANDALONE=1 builds (Render / a
 * VPS: nitro `node-server`, no Grok platform middleware). Platform builds get
 * `false`, so standalone-only code is dead-code-eliminated there.
 */
declare const __DEAL_STANDALONE__: boolean;
