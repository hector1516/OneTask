var blockPc = { id: 'block-pc', version: '1.0.0', run: async function(params, ctx) { return { ok: true, action: 'lock', msg: 'Lock command sent', at: new Date().toISOString() }; } };
