import { GATE_BLOCKS, type Block, type Tile, type Wire } from "./types";

export function channelName(channel: number): string {
	const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

	let out = "";
	do {
		out = ALPHA[channel % ALPHA.length] + out;
		channel = Math.floor(channel / ALPHA.length);
	} while (channel);

	return out;
};

const endingWire = (tile: Tile): Wire => {
	switch (tile.type) {
		case "measure":
			return tile.inverse ? "quantum" : "classical";

		case "gate":
			return "quantum";

		default:
			return tile.wire;
	}
};

const bounds = (block: Block, channels: number): [number, number] => {
	switch (block.type) {
		case "repeat-begin":
		case "repeat-end":
		case "medium":
			return [0, channels - 1];

		case "measure":
			return [block.bind, block.bind];

		case "gate":
			return block.binds
				.reduce(
					([min, max], v) => [Math.min(min, v), Math.max(max, v)],
					[block.binds[0], block.binds[0]],
				);

		case "oracle":
			return [
				Math.min(block.xBind, block.firstBind),
				Math.max(block.xBind, block.firstBind + block.width - 1),
			];
	}
};

const rangeInclusive = (min: number, max: number): Set<number> =>
	new Set(Array(1 + max - min).fill(0).map((_, i) => min + i));

export function calcTiles(
	channels: number,
	blocks: Block[],
	compact: boolean,
): Tile[][] {
	let column: Tile[] = Array(channels)
		.fill(null)
		.map(() => ({
			type: "wire",
			crossing: null,
			wire: "quantum",
		}));
	const tiles: Tile[][] = Array(channels)
		.fill(null)
		.map(() => []);

	if (!blocks.length) return tiles;

	let filled = new Set();
	let [min, max] = bounds(blocks[0], channels);
	let x = 0;

	for (const block of blocks) {
		if (max >= channels) return []; // invalid

		switch (block.type) {
			case "repeat-begin":
			case "repeat-end":
				column = column.map((tile, i) => ({
					type: "repeat",
					connect: {
						up: i > 0,
						down: i + 1 < channels,
					},
					side: block.type == "repeat-begin" ? "begin" : "end",
					...(block.type == "repeat-end" && { count: block.count }),
					wire: endingWire(tile),
				} as Tile));
				break;

			case "measure":
				column[block.bind] = {
					type: "measure",
					inverse: false,
				};
				break;

			case "gate":
				for (let i = min + 1; i < max; i++)
					if (column[i].type == "wire")
						(column[i] as any).crossing = "wire";

				for (let i = 0; i < GATE_BLOCKS[block.gate].binds.length; i++) {
					const y = block.binds[i];

					column[y] = {
						type: block.gate == "swap" ? "swap" : (i ? "control" : "gate"),
						control: {
							up: y > min,
							down: y < max,
						},
						wire: endingWire(column[y]),
						negative: false,
						...(block.gate != "swap" && !i && {
							label: GATE_BLOCKS[block.gate].binds[0],
							input: null,
							connect: {
								up: false,
								down: false,
							},
						}),
					} as Tile;
				}

				break;

			case "oracle":
				for (let i = min + 1; i < max; i++)
					if (column[i].type == "wire")
						(column[i] as any).crossing = "wire";

				column[block.xBind] = {
					type: "gate",
					label: "x",
					input: null,
					connect: {
						up: false,
						down: false,
					},
					control: {
						up: min < block.xBind,
						down: max > block.xBind,
					},
					wire: endingWire(column[block.xBind]),
				};

				for (let i = 0; i < block.width; i++) {
					const y = block.firstBind + i;
					column[y] = {
						type: "control",
						control: {
							up: min < y,
							down: max > y,
						},
						negative: !((1 << i) & block.match),
						wire: endingWire(column[y]),
					};
				}

				break;
		}

		if (++x < blocks.length) {
			filled = filled.union(rangeInclusive(min, max));
			[min, max] = bounds(blocks[x], channels);
			if (compact && filled.isDisjointFrom(rangeInclusive(min, max)))
				continue;
		}

		filled = new Set();
		tiles.forEach((row, i) => {
			row.push(column[i]);
			column[i] = {
				type: "wire",
				crossing: null,
				wire: endingWire(column[i]),
			};
		});
	}

	return tiles;
}
