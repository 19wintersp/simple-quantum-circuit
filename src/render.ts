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

export function endingWire(tile: Tile): Wire {
	switch (tile.type) {
		case "measure":
			return tile.inverse ? "quantum" : "classical";

		case "gate":
			return "quantum";

		default:
			return tile.wire;
	}
}

export function calcTiles(
	channels: number,
	blocks: Block[],
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

	for (const block of blocks) {
		switch (block.type) {
			case "repeat-begin":
				column = column.map((tile, i) => ({
					type: "repeat",
					connect: {
						up: i > 0,
						down: i + 1 < channels,
					},
					side: "begin",
					wire: endingWire(tile),
				}));
				break;

			case "repeat-end":
				column = column.map((tile, i) => ({
					type: "repeat",
					connect: {
						up: i > 0,
						down: i + 1 < channels,
					},
					side: "end",
					count: block.count,
					wire: endingWire(tile),
				}));
				break;

			case "measure":
				column = column.map((tile, i) => (
					i == block.bind
						? {
								type: "measure",
								inverse: false,
							}
						: {
								type: "wire",
								crossing: null,
								wire: endingWire(tile),
							}
				));
				break;

			case "gate": {
				const [min, max] = block.binds
					.reduce(
						([min, max], v) => [Math.min(min, v), Math.max(max, v)],
						[block.binds[0], block.binds[0]],
					);
				column = column.map((tile, i) => ({
					type: "wire",
					crossing: min < i && i < max ? "wire" : null,
					wire: endingWire(tile),
				}));

				for (let i = 0; i < GATE_BLOCKS[block.gate].binds.length; i++) {
					const y = block.binds[i];
					if (y >= channels) continue; // invalid

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
			}

			case "oracle": {
				const min = Math.min(block.xBind, block.firstBind);
				const max = Math.max(block.xBind, block.firstBind + block.width - 1);

				column = column.map((tile, i) =>
					i < block.firstBind || i >= block.firstBind + block.width
						? (
								i == block.xBind
									? {
											type: "gate",
											label: "x",
											input: null,
											connect: {
												up: false,
												down: false,
											},
											control: {
												up: min < i,
												down: max > i,
											},
											wire: endingWire(tile),
										}
									: {
											type: "wire",
											crossing: min < i && i < max ? "wire" : null,
											wire: endingWire(tile),
										}
							)
						: {
								type: "control",
								control: {
									up: min < i,
									down: max > i,
								},
								negative: !((1 << (i - block.firstBind)) & block.match),
								wire: endingWire(tile),
							}
				);

				break;
			}
		}

		tiles.forEach((row, i) => row.push(column[i]));
	}

	return tiles;
}
