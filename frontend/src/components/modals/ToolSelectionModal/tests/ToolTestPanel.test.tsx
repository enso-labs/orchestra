import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ToolTestPanel } from "../components/ToolTestPanel";
import { ArgField } from "../components/ArgsSchemaBuilder";
import { describe, it, expect, vi } from "vitest";

describe("ToolTestPanel", () => {
    const mockOnInvoke = vi.fn();
    const argsSchema: Record<string, ArgField> = {
        param1: { type: "str", description: "desc", required: true },
        param2: { type: "int", description: "desc", required: false, default: 42 }
    };

    it("renders inputs based on schema", () => {
        render(
            <ToolTestPanel 
                argsSchema={argsSchema} 
                onInvoke={mockOnInvoke} 
                isLoading={false} 
                isConfigValid={true} 
            />
        );
        expect(screen.getByText("param1")).toBeInTheDocument();
        expect(screen.getByText("param2")).toBeInTheDocument();
        // Check default value
        expect(screen.getByDisplayValue("42")).toBeInTheDocument();
    });

    it("calls onInvoke with correct arguments", () => {
        render(
            <ToolTestPanel 
                argsSchema={argsSchema} 
                onInvoke={mockOnInvoke} 
                isLoading={false} 
                isConfigValid={true} 
            />
        );
        
        // Find input for param1 by placeholder
        const inputs = screen.getAllByPlaceholderText("Enter text...");
        fireEvent.change(inputs[0], { target: { value: "hello" } });
        
        fireEvent.click(screen.getByText("Invoke"));
        
        expect(mockOnInvoke).toHaveBeenCalledWith(expect.objectContaining({
            param1: "hello",
            param2: 42
        }));
    });

    it("disables invoke button when config is invalid", () => {
        render(
            <ToolTestPanel 
                argsSchema={argsSchema} 
                onInvoke={mockOnInvoke} 
                isLoading={false} 
                isConfigValid={false} 
            />
        );
        
        const button = screen.getByText("Invoke").closest("button");
        expect(button).toBeDisabled();
        expect(screen.getByText("Configuration Incomplete")).toBeInTheDocument();
    });
});

