import { type Block, Complex, GATE_BLOCKS, Qubit, Register, StaticGate } from "./types";

type Loop = {
	block: number;
	runs: number;
};

export type Value = {
	one: number;
	entangled: boolean;
};

export function calcValues(
	channels: number,
	initialValues: Qubit[],
	blocks: Block[],
): Value[] {
	try {
		const register = Register.fromUnentangled(initialValues.slice(0, channels));
		const loops: Loop[] = [];

		for (let i = 0; i < blocks.length; i++) {
			const block = blocks[i];
			switch (block.type) {
				case "repeat-begin":
					loops.push({
						block: i,
						runs: 0,
					});
					break;

				case "repeat-end":
					if (!loops.length) return []; // invalid

					if (++loops.at(-1)!.runs >= block.count)
						loops.pop();
					else
						i = loops.at(-1)!.block;

					break;

				case "measure":
					register.collapse(block.bind);
					break;

				case "gate":
					register.map(block.binds, GATE_BLOCKS[block.gate].gate.forward());
					break;

				case "oracle":
					if (block.match >= (1 << block.width)) return []; // invalid

					const gate = StaticGate.identity(block.width + 1);
					const basis = block.match << 1;
					gate.matrix[basis + 0][basis + 0] = Complex.ZERO;
					gate.matrix[basis + 0][basis + 1] = Complex.ONE;
					gate.matrix[basis + 1][basis + 0] = Complex.ONE;
					gate.matrix[basis + 1][basis + 1] = Complex.ZERO;

					const binds = Array(block.width)
						.fill(null)
						.map((_, i) => block.firstBind + i);

					register.map([block.xBind].concat(binds), gate.forward());
					break;
			}
		}

		(window as any).__states = register.states;

		return Array(channels)
			.fill(null)
			.map((_, i) => ({
				one: register.aggregate(i),
				entangled: !register.independent(i),
			}));
	} catch (err) {
		console.error(err);
		return [];
	}
}
