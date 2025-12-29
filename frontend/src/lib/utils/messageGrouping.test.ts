import { describe, it, expect } from 'vitest';
import {
	groupToolMessages,
	correlateToolCalls,
	getStableGroupId,
	type Message,
	type ToolCallComplete,
	type ToolMessage,
} from './messageGrouping';

describe('messageGrouping', () => {
	describe('groupToolMessages', () => {
		it('should return empty array for empty input', () => {
			const result = groupToolMessages([]);
			expect(result).toEqual([]);
		});

		it('should group single tool call with input and output', () => {
			const messages: Message[] = [
				{
					id: 'a1',
					type: 'assistant',
					content: '',
					tool_calls: [{ id: 't1', name: 'search', args: { q: 'test' } }],
				},
				{
					id: 'o1',
					type: 'tool',
					role: 'tool',
					tool_call_id: 't1',
					name: 'search',
					content: 'result',
				},
			];

			const grouped = groupToolMessages(messages);
			expect(grouped).toHaveLength(1);
			expect(grouped[0].type).toBe('tool_group');
			if (grouped[0].type === 'tool_group') {
				expect(grouped[0].toolCalls).toHaveLength(1);
				expect(grouped[0].toolCalls[0].output?.id).toBe('o1');
				expect(grouped[0].toolCalls[0].status).toBe('success');
			}
		});

		it('should group multiple consecutive tool calls', () => {
			const messages: Message[] = [
				{
					id: 'a1',
					type: 'assistant',
					content: '',
					tool_calls: [
						{ id: 't1', name: 'search', args: {} },
						{ id: 't2', name: 'calculate', args: {} },
					],
				},
				{ id: 'o1', type: 'tool', role: 'tool', tool_call_id: 't1', name: 'search', content: 'r1' },
				{ id: 'o2', type: 'tool', role: 'tool', tool_call_id: 't2', name: 'calculate', content: 'r2' },
			];

			const grouped = groupToolMessages(messages);
			expect(grouped).toHaveLength(1);
			if (grouped[0].type === 'tool_group') {
				expect(grouped[0].toolCalls).toHaveLength(2);
			}
		});

		it('should separate groups by user messages', () => {
			const messages: Message[] = [
				{
					id: 'a1',
					type: 'assistant',
					content: '',
					tool_calls: [{ id: 't1', name: 'search', args: {} }],
				},
				{ id: 'o1', type: 'tool', role: 'tool', tool_call_id: 't1', name: 'search', content: 'r1' },
				{ id: 'u1', type: 'user', content: 'follow up' },
				{
					id: 'a2',
					type: 'assistant',
					content: '',
					tool_calls: [{ id: 't2', name: 'calculate', args: {} }],
				},
				{ id: 'o2', type: 'tool', role: 'tool', tool_call_id: 't2', name: 'calculate', content: 'r2' },
			];

			const grouped = groupToolMessages(messages);
			expect(grouped).toHaveLength(3); // [group1, user, group2]
			expect(grouped[0].type).toBe('tool_group');
			expect(grouped[1].type).toBe('regular');
			expect(grouped[2].type).toBe('tool_group');
		});

		it('should handle tool input without output (pending)', () => {
			const messages: Message[] = [
				{
					id: 'a1',
					type: 'assistant',
					content: '',
					tool_calls: [{ id: 't1', name: 'search', args: { q: 'test' } }],
				},
			];

			const grouped = groupToolMessages(messages);
			expect(grouped).toHaveLength(1);
			if (grouped[0].type === 'tool_group') {
				expect(grouped[0].toolCalls[0].status).toBe('pending');
				expect(grouped[0].toolCalls[0].output).toBeUndefined();
			}
		});

		it('should handle orphaned tool output (no input)', () => {
			const messages: Message[] = [
				{
					id: 'o1',
					type: 'tool',
					role: 'tool',
					tool_call_id: 't1',
					name: 'search',
					content: 'result',
				},
			];

			const grouped = groupToolMessages(messages);
			expect(grouped).toHaveLength(1);
			expect(grouped[0].type).toBe('tool_group');
			if (grouped[0].type === 'tool_group') {
				expect(grouped[0].toolCalls[0].name).toBe('search');
				expect(grouped[0].toolCalls[0].output?.content).toBe('result');
			}
		});

		it('should correlate by tool_call_id', () => {
			const messages: Message[] = [
				{
					id: 'a1',
					type: 'assistant',
					content: '',
					tool_calls: [
						{ id: 'call-abc', name: 'search', args: { q: 'test' } },
						{ id: 'call-xyz', name: 'calculate', args: { x: 5 } },
					],
				},
				{ id: 'o2', type: 'tool', role: 'tool', tool_call_id: 'call-xyz', name: 'calculate', content: '25' },
				{ id: 'o1', type: 'tool', role: 'tool', tool_call_id: 'call-abc', name: 'search', content: 'results' },
			];

			const grouped = groupToolMessages(messages);
			if (grouped[0].type === 'tool_group') {
				expect(grouped[0].toolCalls[0].name).toBe('search');
				expect(grouped[0].toolCalls[0].output?.id).toBe('o1');
				expect(grouped[0].toolCalls[1].name).toBe('calculate');
				expect(grouped[0].toolCalls[1].output?.id).toBe('o2');
			}
		});

		it('should generate stable group IDs', () => {
			const messages: Message[] = [
				{
					id: 'a1',
					type: 'assistant',
					content: '',
					tool_calls: [{ id: 't1', name: 'search', args: {} }],
				},
			];

			const grouped1 = groupToolMessages(messages);
			const grouped2 = groupToolMessages(messages);
			if (grouped1[0].type === 'tool_group' && grouped2[0].type === 'tool_group') {
				expect(grouped1[0].id).toBe(grouped2[0].id);
			}
		});

		it('should handle mixed content and tools', () => {
			const messages: Message[] = [
				{ id: 'u1', type: 'user', content: 'question' },
				{
					id: 'a1',
					type: 'assistant',
					content: '',
					tool_calls: [{ id: 't1', name: 'search', args: {} }],
				},
				{ id: 'o1', type: 'tool', role: 'tool', tool_call_id: 't1', name: 'search', content: 'result' },
				{ id: 'a2', type: 'assistant', content: 'Here is the answer' },
			];

			const grouped = groupToolMessages(messages);
			expect(grouped).toHaveLength(3); // [user, tool_group, assistant]
			expect(grouped[0].type).toBe('regular');
			expect(grouped[1].type).toBe('tool_group');
			expect(grouped[2].type).toBe('regular');
		});

		it('should handle multiple tools with same name', () => {
			const messages: Message[] = [
				{
					id: 'a1',
					type: 'assistant',
					content: '',
					tool_calls: [
						{ id: 't1', name: 'search', args: { q: 'cats' } },
						{ id: 't2', name: 'search', args: { q: 'dogs' } },
						{ id: 't3', name: 'search', args: { q: 'birds' } },
					],
				},
				{ id: 'o1', type: 'tool', role: 'tool', tool_call_id: 't1', name: 'search', content: 'r1' },
				{ id: 'o2', type: 'tool', role: 'tool', tool_call_id: 't2', name: 'search', content: 'r2' },
				{ id: 'o3', type: 'tool', role: 'tool', tool_call_id: 't3', name: 'search', content: 'r3' },
			];

			const grouped = groupToolMessages(messages);
			if (grouped[0].type === 'tool_group') {
				expect(grouped[0].toolCalls).toHaveLength(3);
				expect(grouped[0].toolCalls.every(tc => tc.name === 'search')).toBe(true);
				expect(grouped[0].toolCalls.every(tc => tc.output)).toBe(true);
			}
		});

		it('should handle empty tool_calls array', () => {
			const messages: Message[] = [
				{
					id: 'a1',
					type: 'assistant',
					content: 'Just a message',
					tool_calls: [],
				},
			];

			const grouped = groupToolMessages(messages);
			expect(grouped).toHaveLength(1);
			expect(grouped[0].type).toBe('regular');
		});

		it('should handle null and undefined fields gracefully', () => {
			const messages: Message[] = [
				{
					id: 'a1',
					type: 'assistant',
					content: '',
					tool_calls: [{ id: 't1', name: 'search', args: null as any }],
				},
				{
					id: 'o1',
					type: 'tool',
					role: 'tool',
					tool_call_id: 't1',
					name: undefined as any,
					content: 'result',
				},
			];

			const grouped = groupToolMessages(messages);
			expect(grouped).toHaveLength(1);
			if (grouped[0].type === 'tool_group') {
				expect(grouped[0].toolCalls).toHaveLength(1);
				// Should handle undefined name gracefully
				expect(grouped[0].toolCalls[0].name).toBeDefined();
			}
		});

		it('should handle tool_call_chunks instead of tool_calls', () => {
			const messages: Message[] = [
				{
					id: 'a1',
					type: 'assistant',
					content: '',
					tool_call_chunks: [{ name: 'search', args: '{"q":"test"}', id: 't1' }],
					input: { q: 'test' },
				},
				{ id: 'o1', type: 'tool', role: 'tool', tool_call_id: 't1', name: 'search', content: 'result' },
			];

			const grouped = groupToolMessages(messages);
			expect(grouped).toHaveLength(1);
			if (grouped[0].type === 'tool_group') {
				expect(grouped[0].toolCalls).toHaveLength(1);
				expect(grouped[0].toolCalls[0].input).toEqual({ q: 'test' });
			}
		});

		it('should perform grouping in O(n) time for large arrays', () => {
			// Generate 1000 messages
			const messages: Message[] = [];
			for (let i = 0; i < 500; i++) {
				messages.push({
					id: `a${i}`,
					type: 'assistant',
					content: '',
					tool_calls: [{ id: `t${i}`, name: 'search', args: {} }],
				});
				messages.push({
					id: `o${i}`,
					type: 'tool',
					role: 'tool',
					tool_call_id: `t${i}`,
					name: 'search',
					content: 'result',
				});
			}

			const start = performance.now();
			const grouped = groupToolMessages(messages);
			const duration = performance.now() - start;

			expect(grouped).toHaveLength(500);
			expect(duration).toBeLessThan(10); // Should complete in <10ms
		});
	});

	describe('correlateToolCalls', () => {
		it('should match outputs to inputs by ID', () => {
			const toolCalls: ToolCallComplete[] = [
				{ id: 't1', name: 'search', args: { q: 'test' } },
			];
			const toolMessages: ToolMessage[] = [
				{ id: 'o1', type: 'tool', role: 'tool', tool_call_id: 't1', name: 'search', content: 'result' },
			];

			const correlated = correlateToolCalls(toolCalls, toolMessages);
			expect(correlated).toHaveLength(1);
			expect(correlated[0].output?.id).toBe('o1');
			expect(correlated[0].status).toBe('success');
		});

		it('should handle missing outputs (pending)', () => {
			const toolCalls: ToolCallComplete[] = [
				{ id: 't1', name: 'search', args: {} },
			];
			const toolMessages: ToolMessage[] = [];

			const correlated = correlateToolCalls(toolCalls, toolMessages);
			expect(correlated).toHaveLength(1);
			expect(correlated[0].output).toBeUndefined();
			expect(correlated[0].status).toBe('pending');
		});

		it('should handle extra outputs (orphaned)', () => {
			const toolCalls: ToolCallComplete[] = [];
			const toolMessages: ToolMessage[] = [
				{ id: 'o1', type: 'tool', role: 'tool', tool_call_id: 't1', name: 'search', content: 'result' },
			];

			const correlated = correlateToolCalls(toolCalls, toolMessages);
			expect(correlated).toHaveLength(1);
			expect(correlated[0].output?.id).toBe('o1');
			expect(correlated[0].name).toBe('search');
		});

		it('should preserve input order', () => {
			const toolCalls: ToolCallComplete[] = [
				{ id: 't1', name: 'first', args: {} },
				{ id: 't2', name: 'second', args: {} },
				{ id: 't3', name: 'third', args: {} },
			];
			const toolMessages: ToolMessage[] = [
				{ id: 'o3', type: 'tool', role: 'tool', tool_call_id: 't3', name: 'third', content: 'r3' },
				{ id: 'o1', type: 'tool', role: 'tool', tool_call_id: 't1', name: 'first', content: 'r1' },
				{ id: 'o2', type: 'tool', role: 'tool', tool_call_id: 't2', name: 'second', content: 'r2' },
			];

			const correlated = correlateToolCalls(toolCalls, toolMessages);
			expect(correlated[0].name).toBe('first');
			expect(correlated[1].name).toBe('second');
			expect(correlated[2].name).toBe('third');
		});

		it('should handle error status', () => {
			const toolCalls: ToolCallComplete[] = [
				{ id: 't1', name: 'search', args: {} },
			];
			const toolMessages: ToolMessage[] = [
				{
					id: 'o1',
					type: 'tool',
					role: 'tool',
					tool_call_id: 't1',
					name: 'search',
					content: 'error',
					status: 'error',
				},
			];

			const correlated = correlateToolCalls(toolCalls, toolMessages);
			expect(correlated[0].status).toBe('error');
		});
	});

	describe('getStableGroupId', () => {
		it('should generate consistent IDs', () => {
			const id1 = getStableGroupId('msg-123', 3);
			const id2 = getStableGroupId('msg-123', 3);
			expect(id1).toBe(id2);
			expect(id1).toBe('tool-group-msg-123-3');
		});

		it('should generate unique IDs for different inputs', () => {
			const id1 = getStableGroupId('msg-123', 3);
			const id2 = getStableGroupId('msg-456', 3);
			const id3 = getStableGroupId('msg-123', 5);

			expect(id1).not.toBe(id2);
			expect(id1).not.toBe(id3);
		});
	});
});
