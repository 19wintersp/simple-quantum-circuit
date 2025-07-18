import { createEffect, createMemo, createSignal, For, Index } from "solid-js";
import { createStore, produce } from "solid-js/store";

import "./App.css";

import BlockHeader from "./Block";
import Tile from "./Tile";
import { PRESETS, type Preset } from "./presets";
import { calcTiles, channelName } from "./render";
import { calcValues } from "./run";
import { type Block, Qubit } from "./types";

const MAX_CHANNELS = 16;

const INITIAL_VALUES: Qubit[] = Array(MAX_CHANNELS).fill(Qubit.ZERO);
const INITIAL_BLOCKS: Block[] = [
	{
		type: "gate",
		gate: "h",
		binds: [0],
	},
	{
		type: "gate",
		gate: "cx",
		binds: [1, 0],
	},
];

const QUBIT_PRESET: Map<string, Qubit> = new Map([
	["0", Qubit.ZERO],
	["1", Qubit.ONE],
	["+", Qubit.POS],
	["-", Qubit.NEG],
]);

export default function App() {
	let initChannels = 3;
	let initInitialValues = INITIAL_VALUES;
	let initBlocks = INITIAL_BLOCKS;

	if (location.hash) {
		try {
			const state: {
				ch: number,
				iv: number[][][],
				bl: Block[],
			} = JSON.parse(decodeURIComponent(location.hash.substring(1)));

			initChannels = state.ch;
			initInitialValues = state.iv
				.map((qubit) => Qubit.fromJSON(qubit))
				.concat(INITIAL_VALUES)
				.slice(0, MAX_CHANNELS);
			initBlocks = state.bl;
		} catch {}
	}

	const [channels, setChannels] = createSignal(initChannels);

	const [initialValues, setInitialValues] = createStore(initInitialValues);
	const [blocks, setBlocks] = createStore(initBlocks);

	const tiles = createMemo(() => calcTiles(channels(), blocks));
	const values = createMemo(() => calcValues(channels(), initialValues, blocks));

	createEffect(() => {
		const state = {
			ch: channels(),
			iv: initialValues.slice(0, channels()),
			bl: blocks.concat([]),
		};

		location.hash = "#" + encodeURIComponent(JSON.stringify(state));
	});

	const insert = (before: number) =>
		() => setBlocks(produce((blocks) => blocks.splice(before, 0, {
			type: "gate",
			gate: "x",
			binds: [0],
		})));

	const setPreset = (preset: Preset) =>
		() => {
			setChannels(preset.initialValues.length);
			setInitialValues(
				preset.initialValues
					.concat(INITIAL_VALUES)
					.slice(0, MAX_CHANNELS)
			);
			setBlocks(preset.blocks);
		};

	let channelsInput: HTMLInputElement | undefined;

	return <>
		<nav>
			<span>Examples:</span>
			<For each={PRESETS}>
				{(preset) => (
					<button onClick={setPreset(preset)}>{preset.name}</button>
				)}
			</For>

			<div class="spacer"></div>

			<p>Edit mode</p>
		</nav>

		<main>
			<div id="header">
				<div>
					<div class="header-controls">
						<button onClick={insert(0)}>＋</button>
					</div>

					<div class="props">
						<label for="n-channels">Channels</label>
						<input
							type="number"
							ref={channelsInput}
							min="1"
							max={MAX_CHANNELS}
							value={channels()}
							onInput={() =>
								channelsInput!.validity.valid
									&& setChannels(channelsInput!.valueAsNumber)
							}
						/>
					</div>
				</div>

				<For each={blocks}>
					{(block, i) => <div>
						<div class="header-controls">
							<button
								onClick={() => setBlocks(produce((blocks) =>
									i()
										? blocks.splice(i() - 1, 0, ...blocks.splice(i(), 1))
										: blocks.push(...blocks.splice(0, 1))
								))}
							>＜</button>
							<button
								onClick={() =>
									setBlocks(produce((blocks) => blocks.splice(i(), 1)))
								}
							>－</button>
							<button
								onClick={() => setBlocks(produce((blocks) =>
									i() + 1 < blocks.length
										? blocks.splice(i() + 1, 0, ...blocks.splice(i(), 1))
										: blocks.splice(0, 0, blocks.pop()!)
								))}
							>＞</button>
							<button onClick={insert(i() + 1)}>＋</button>
						</div>

						<BlockHeader
							block={block}
							setBlock={(block) => setBlocks(i(), block)}
							channels={channels}
						/>
					</div>}
				</For>

				<div></div>
			</div>

			<Index each={tiles()}>
				{(row, i) => {
					const id = `iv-${i}`;
					let select: HTMLSelectElement | undefined;

					return (
						<div>
							<div class="initial-value">
								<label for={id}>{channelName(i)}</label>
								<select
									id={id}
									ref={select}
									onChange={() =>
										setInitialValues(i, QUBIT_PRESET.get(select!.value)!)
									}
								>
									<For each={Array.from(QUBIT_PRESET.entries())}>
										{([id, qubit]) => (
											<option
												value={id}
												selected={initialValues[i].approx(qubit)}
											>|{id}⟩</option>
										)}
									</For>
								</select>
							</div>

							<For each={row()}>
								{(tile) => <Tile tile={tile} />}
							</For>

							<div class="output-value">
								<span>{
									values()[i]
										? `P(1) ≈ ${values()[i].one.toFixed(3)}`
												+ (values()[i].entangled ? "*" : "")
										: "Error?"
								}</span>
							</div>
						</div>
					);
				}}
			</Index>
		</main>
	</>;
};
