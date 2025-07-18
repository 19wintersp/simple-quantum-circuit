import { For, type JSX } from "solid-js";
import type { Connect, Tile } from "./types";

export default function({ tile }: {
	tile: Tile;
}) {
	const W = 150;
	const H = 100;
	const G = 50;
	const P = 8;
	const S = 2;

	const hl: [number, number, boolean][] = [];
	const vl: [number, number][] = [];
	let box: Connect | null = null;

	switch (tile.type) {
		case "measure":
			if (tile.inverse) {
				hl.push([0, W / 2 - S, true]);
				hl.push([W / 2 + S, W, false]);
			} else {
				hl.push([0, (W - G) / 2, false]);
				hl.push([(W + G) / 2, W, true]);
				box = { up: false, down: false };
			}
			break;

		case "repeat": {
			const c = tile.wire == "classical";
			hl.push([0, W / 2 - P, c]);
			hl.push([W / 2 + P, W, c]);
			vl.push([
				tile.connect.up ? 0 : 30,
				H - (tile.connect.down ? 0 : 30),
			]);
			break;
		}

		case "wire": {
			const c = tile.wire == "classical";
			switch (tile.crossing) {
				case "wire":
					hl.push([0, W / 2 - P, c]);
					hl.push([W / 2 + P, W, c]);
					vl.push([0, H]);
					break;

				case "gate":
					hl.push([0, (W - G) / 2 - P, c]);
					hl.push([(W + G) / 2 + P, W, c]);
					box = { up: true, down: true };
					break;

				default:
					hl.push([0, W, c]);
					break;
			}
			break;
		}

		case "control":
		case "swap":
			hl.push([0, W, tile.wire == "classical"]);
			if (tile.control.up)
				vl.push([0, H / 2]);
			if (tile.control.down)
				vl.push([H / 2, H]);
			break;

		case "gate":
			hl.push([0, (W - G) / 2, tile.wire == "classical"]);
			hl.push([(W + G) / 2, W, false]);
			if (tile.control.up)
				vl.push([0, (H - G) / 2]);
			if (tile.control.down)
				vl.push([(H + G) / 2, H]);
			box = tile.connect;
			break;
	}

	const Line = (props: JSX.PathSVGAttributes<SVGPathElement>) => (
		<path stroke="black" stroke-width={S} fill="none" {...props} />
	);

	const Poly = (props: { points: [number, number][] }) => (
		<Line d={"M" + props.points.map(([x, y]) => `${x} ${y}`).join("L")} />
	);

	return (
		<svg width="150" height="100" viewBox="0 0 150 100">
			{tile.type == "measure" && tile.inverse && (
				<Poly points={[
					[W / 2 - S - 2, H / 2 - S],
					[W / 2 - S, H / 2 - S],
					[W / 2 + S, H / 2],
					[W / 2 - S, H / 2 + S],
					[W / 2 - S - 2, H / 2 + S],
				]} />
			)}

			{tile.type == "measure" && !tile.inverse && (
				<Line
					d={`
						M${W / 2 - 12} ${H / 2 + 6}
						a12 12 0 0 1 24 0
						m-12 0
						l12 -12
					`}
				/>
			)}

			{tile.type == "repeat" && !tile.connect.up && (
				<Line
					d={`
						M${W / 2 + (tile.side == "end" ? -20 : 20)} 10
						A20 20 0 0 ${tile.side == "end" ? 0 : 1} ${W / 2} 30
					`}
					stroke-linecap="square"
				/>
			)}

			{tile.type == "repeat" && !tile.connect.down && (
				<Line
					d={`
						M${W / 2 + (tile.side == "end" ? -20 : 20)} ${H - 10}
						A20 20 0 0 ${tile.side == "end" ? 1 : 0} ${W / 2} ${H - 30}
					`}
					stroke-linecap="square"
				/>
			)}

			{tile.type == "repeat" && tile.side == "end" && !tile.connect.down && (
				<text
					x={W / 2 + 10}
					y={H - 10}
					font-size="16"
				>{tile.count}</text>
			)}

			{tile.type == "swap" && <>
				<Poly points={[[W / 2 - 8, H / 2 - 8], [W / 2 + 8, H / 2 + 8]]} />
				<Poly points={[[W / 2 - 8, H / 2 + 8], [W / 2 + 8, H / 2 - 8]]} />
			</>}

			{tile.type == "gate" && tile.label && (
				<text
					x={W / 2}
					y={H / 2}
					font-size="32"
					dominant-baseline="middle"
					text-anchor="middle"
				>{tile.label}</text>
			)}

			{tile.type == "gate" && tile.input && (
				<text
					x={(W - G) / 2 - P}
					y={H / 2 - P}
					font-size="16"
					text-anchor="end"
				>{tile.input}</text>
			)}

			<For each={hl}>
				{([x1, x2, double]) => double
					? <>
							<Poly points={[[x1, H / 2 - S], [x2, H / 2 - S]]} />
							<Poly points={[[x1, H / 2 + S], [x2, H / 2 + S]]} />
						</>
					: <Poly points={[[x1, H / 2], [x2, H / 2]]} />
				}
			</For>

			<For each={vl}>
				{([y1, y2]) => <Poly points={[[W / 2, y1], [W / 2, y2]]} />}
			</For>

			{box && (
				<rect
					x={(W - G) / 2}
					y={box.up ? -G / 2 : (H - G) / 2}
					width={G}
					height={
						box.up && box.down
							? 2 * H
							: (box.up || box.down ? H : G)
					}
					stroke="black"
					stroke-width={S}
					fill="none"
				/>
			)}

			{tile.type == "control" && (
				<ellipse
					cx={W / 2}
					cy={H / 2}
					rx={5}
					ry={5}
					fill={tile.negative ? "white" : "black"}
					stroke="black"
					stroke-width={tile.negative ? S : 1}
				/>
			)}
		</svg>
	);
}
