import { describe, test, expect, beforeAll } from "bun:test";
import { appRouter } from "../../src/routers/index";
import { db, tables } from "@learn-bettert/db";
import type { Context } from "../../src/context";
import { mockWsNotifier } from "../setup";

/**
 * T038: Contract test for tables.getById
 * Contract: tables-router.md Procedure 2
 * TDD Red Phase: This test should FAIL before implementation
 */

// Mock context for testing
const mockContext: Context = {
	session: null,
	user: null,
	role: null,
	db,
	wsNotifier: mockWsNotifier,
};

describe("Tables Router - tables.getById", () => {
	let testTableId: number;

	beforeAll(async () => {
		// Check if table already exists from previous test run
		const existing = await db.query.tables.findFirst({
			where: (tables, { eq }) => eq(tables.number, 99),
		});

		if (existing) {
			testTableId = existing.id;
		} else {
			// Create a test table for validation
			const [table] = await db.insert(tables).values({
				number: 99,
				qrCode: "https://app.restauranthub.com/?table=99",
				capacity: 4,
			}).returning();
			testTableId = table.id;
		}
	});

	test("should return table when valid ID provided", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.tables.getById({ tableId: testTableId });

		expect(result).toBeDefined();
		expect(result.id).toBe(testTableId);
		expect(result.number).toBe(99);
		expect(result.qrCode).toBe("https://app.restauranthub.com/?table=99");
		expect(result.capacity).toBe(4);
		expect(result.isValid).toBe(true);
	});

	test("should return isValid: false when table does not exist", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.tables.getById({ tableId: 99999 });

		expect(result).toBeDefined();
		expect(result.isValid).toBe(false);
	});

	test("should validate tableId is a number", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		await expect(
			caller.tables.getById({ tableId: "invalid" as any })
		).rejects.toThrow();
	});
});
