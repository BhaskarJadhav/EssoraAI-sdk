import type {
  ClickyActionContext,
  ClickyActionDefinition,
  ClickyActionResult,
  ClickyCapturedContext,
  ClickyProposedAction
} from "../core/types";
import { ElementRegistry } from "../context/ElementRegistry";
import { validateRequiredObjectProperties } from "./actionTypes";

export class ActionExecutor {
  constructor(private readonly elementRegistry: ElementRegistry) {}

  createProposedAction(
    actionDefinition: ClickyActionDefinition,
    parameters: Record<string, unknown>
  ): ClickyProposedAction {
    const missingProperties = validateRequiredObjectProperties(actionDefinition.parametersSchema, parameters);
    if (missingProperties.length > 0) {
      throw new Error(`Action ${actionDefinition.id} is missing required parameter(s): ${missingProperties.join(", ")}`);
    }

    if (!actionDefinition.allowSensitiveFields && this.includesSensitiveParameter(parameters)) {
      throw new Error(`Action ${actionDefinition.id} attempted to use a sensitive parameter`);
    }

    return {
      actionId: actionDefinition.id,
      parameters,
      definition: actionDefinition
    };
  }

  async executeAction(action: ClickyProposedAction, capturedContext: ClickyCapturedContext): Promise<ClickyActionResult> {
    const actionContext: ClickyActionContext = {
      capturedContext,
      elementRegistry: {
        getElementById: (elementId) => this.getCurrentOrCapturedElement(elementId, capturedContext)
      }
    };

    return await action.definition.execute(action.parameters, actionContext);
  }

  private getCurrentOrCapturedElement(elementId: string, capturedContext: ClickyCapturedContext): Element | undefined {
    const currentElement = this.elementRegistry.getElementById(elementId);
    if (currentElement) {
      return currentElement;
    }

    const capturedElement = capturedContext.elements.find((element) => element.id === elementId);
    if (!capturedElement?.selector) {
      return undefined;
    }

    try {
      return document.querySelector(capturedElement.selector) ?? undefined;
    } catch {
      return undefined;
    }
  }

  private includesSensitiveParameter(parameters: Record<string, unknown>): boolean {
    return Object.keys(parameters).some((parameterName) =>
      /password|token|secret|credential|otp|one.?time/i.test(parameterName)
    );
  }
}
