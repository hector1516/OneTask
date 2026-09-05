export default { id: 'block-pc', version: '1.0.0', async run(p, c) { return { ok: true, action: 'lock', msg: 'use ctx.system.lock() or ctx.exec()' }; } };
