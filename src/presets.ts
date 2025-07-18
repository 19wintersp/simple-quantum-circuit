import { type Block, Qubit } from "./types";

export type Preset = {
	name: string;
	initialValues: Qubit[];
	blocks: Block[];
};

export const PRESETS: Preset[] = [
	{
		name: "Bell state",
		initialValues: [Qubit.ZERO, Qubit.ZERO],
		blocks: [
			{ type: "gate", gate: "h", binds: [0] },
			{ type: "gate", gate: "cx", binds: [1, 0] },
		],
	},
	{
		name: "Teleportation",
		initialValues: [Qubit.ZERO, Qubit.ZERO, Qubit.POS],
		blocks: [
			{ type: "gate", gate: "h", binds: [0] },
			{ type: "gate", gate: "cx", binds: [1, 0] },
			{ type: "gate", gate: "cx", binds: [0, 2] },
			{ type: "gate", gate: "h", binds: [2] },
			{ type: "measure", bind: 0 },
			{ type: "measure", bind: 2 },
			{ type: "gate", gate: "cx", binds: [1, 0] },
			{ type: "gate", gate: "cz", binds: [1, 2] },
		],
	},
	{
		name: "Grover's alg.",
		initialValues: [Qubit.POS, Qubit.POS, Qubit.POS, Qubit.POS, Qubit.NEG],
		blocks: [
			{ type: "repeat-begin" },
			{ type: "oracle", width: 4, match: 0b0101, firstBind: 0, xBind: 4 },
			{ type: "gate", gate: "h", binds: [0] },
			{ type: "gate", gate: "h", binds: [1] },
			{ type: "gate", gate: "h", binds: [2] },
			{ type: "gate", gate: "h", binds: [3] },
			{ type: "oracle", width: 4, match: 0, firstBind: 0, xBind: 4 },
			{ type: "gate", gate: "h", binds: [0] },
			{ type: "gate", gate: "h", binds: [1] },
			{ type: "gate", gate: "h", binds: [2] },
			{ type: "gate", gate: "h", binds: [3] },
			{ type: "repeat-end", count: 2 },
			{ type: "measure", bind: 0 },
			{ type: "measure", bind: 1 },
			{ type: "measure", bind: 2 },
			{ type: "measure", bind: 3 },
		],
	},
];
