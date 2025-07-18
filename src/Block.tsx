import { type Accessor, createUniqueId, For, Index } from "solid-js";

import "./Block.css";

import { channelName } from "./render";
import { type Block, GATE_BLOCKS, type GateId } from "./types";

type BlockType = {
	name: string;
	match: (block: Block) => boolean;
	apply: (block: Block) => Block;
};

const fillBinds = (block: Block, count: number): number[] =>
	(
		(block.type == "gate" && block.binds)
		|| (block.type == "measure" && [block.bind])
		|| (block.type == "oracle" && [block.firstBind])
		|| []
	)
		.concat(Array(count).fill(0))
		.slice(0, count);

const BLOCK_TYPES: Map<string, BlockType> = new Map([
	["measure", {
		name: "Measurement",
		match: (block) => block.type == "measure",
		apply: (block) => ({
			type: "measure",
			bind: fillBinds(block, 1)[0],
		}),
	}],
	...Object.entries(GATE_BLOCKS)
		.map(([id, gateBlock]): [string, BlockType] => ([`gate:${id}`, {
			name: gateBlock.name,
			match: (block) => block.type == "gate" && block.gate == id,
			apply: (block) => ({
				type: "gate",
				gate: id as GateId,
				binds: fillBinds(block, gateBlock.binds.length),
			}),
		}])),
	["oracle", {
		name: "Toffoli-n (Oracle)",
		match: (block) => block.type == "oracle",
		apply: (block) => ({
			type: "oracle",
			width: 1,
			match: 0,
			firstBind: fillBinds(block, 2)[0],
			xBind: fillBinds(block, 2)[1],
		}),
	}],
	["repeat-begin", {
		name: "Begin repeat",
		match: (block) => block.type == "repeat-begin",
		apply: (_) => ({ type: "repeat-begin" }),
	}],
	["repeat-end", {
		name: "End repeat",
		match: (block) => block.type == "repeat-end",
		apply: (_) => ({ type: "repeat-end", count: 1 }),
	}],
]);

const ChannelSelect = (props: {
	id: string;
	channels: number;
	channel: number;
	setChannel: (channel: number) => void;
}) => {
	let select: HTMLSelectElement | undefined;

	return (
		<select
			ref={select}
			id={props.id}
			onChange={() => props.setChannel(parseInt(select!.value))}
		>
			<Index each={Array(props.channels).fill(null)}>
				{(_, i) => (
					<option
						value={i.toString()}
						selected={i == props.channel}
					>{channelName(i)}</option>
				)}
			</Index>
		</select>
	);
};

export default function(props: {
	block: Block;
	setBlock: (block: Block) => void;
	channels: Accessor<number>;
}) {
	let select: HTMLSelectElement | undefined;
	let input: HTMLInputElement | undefined;
	let input2: HTMLInputElement | undefined;

	const id = createUniqueId();

	return <>
		<select
			class="block-type"
			ref={select}
			onChange={() =>
				props.setBlock(BLOCK_TYPES.get(select!.value)!.apply(props.block))
			}
		>
			<For each={Array.from(BLOCK_TYPES.entries())}>
				{([id, blockType]) => (
					<option
						value={id}
						selected={blockType.match(props.block)}
					>{blockType.name}</option>
				)}
			</For>
		</select>

		<div class="props">
			{props.block.type == "repeat-end" && <>
				<label for={id}>Repeats</label>
				<input
					ref={input}
					id={id}
					type="number"
					min="1"
					value={props.block.count}
					onInput={() =>
						(props.block.type == "repeat-end" && input!.validity.valid)
							&& props.setBlock({
								...props.block,
								count: input!.valueAsNumber,
							})
					}
				/>
			</>}

			{props.block.type == "measure" && <>
				<label for={id}>Channel</label>
				<ChannelSelect
					id={id}
					channels={props.channels()}
					channel={props.block.bind}
					setChannel={(channel) =>
						props.block.type == "measure" && props.setBlock({
							...props.block,
							bind: channel,
						})
					}
				/>
			</>}

			{props.block.type == "gate" && (
				<For each={GATE_BLOCKS[props.block.gate].binds}>
					{(bindName, i) => {
						const idn = `${id}-${i()}`;
						return props.block.type == "gate" && <>
							<label for={idn}>{bindName}</label>
							<ChannelSelect
								id={idn}
								channels={props.channels()}
								channel={props.block.binds[i()]}
								setChannel={(channel) =>
									props.block.type == "gate" && props.setBlock({
										...props.block,
										binds: ((binds) => {
											binds[i()] = channel;
											return binds;
										})(props.block.binds.concat([])),
									})
								}
							/>
						</>;
					}}
				</For>
			)}

			{props.block.type == "oracle" && <>
				<label for={`${id}-w`}>Width</label>
				<input
					ref={input}
					id={`${id}-w`}
					type="number"
					min="1"
					value={props.block.width}
					onInput={() =>
						(props.block.type == "oracle" && input!.validity.valid)
							&& props.setBlock({
								...props.block,
								width: input!.valueAsNumber,
							})
					}
				/>

				<label for={`${id}-m`}>Match</label>
				<input
					ref={input2}
					id={`${id}-m`}
					type="number"
					min="0"
					max={(1 << props.block.width) - 1}
					value={props.block.match}
					onInput={() =>
						(props.block.type == "oracle" && input2!.validity.valid)
							&& props.setBlock({
								...props.block,
								match: input2!.valueAsNumber,
							})
					}
				/>

				<label for={`${id}-c`}>LSB</label>
				<ChannelSelect
					id={`${id}-c`}
					channels={props.channels()}
					channel={props.block.firstBind}
					setChannel={(channel) =>
						props.block.type == "oracle" && props.setBlock({
							...props.block,
							firstBind: channel,
						})
					}
				/>

				<label for={`${id}-x`}>CX</label>
				<ChannelSelect
					id={`${id}-x`}
					channels={props.channels()}
					channel={props.block.xBind}
					setChannel={(channel) =>
						props.block.type == "oracle" && props.setBlock({
							...props.block,
							xBind: channel,
						})
					}
				/>
			</>}
		</div>
	</>;
}
