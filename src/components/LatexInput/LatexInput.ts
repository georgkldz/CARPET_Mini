import type {
  SerializedBaseComponent,
  SerialisedDependencies,
  ComponentDependencies,
  ComponentProps,
  ComponentData,
  JSONPathExpression,
  ValidationConfiguration,
} from "carpet-component-library";
import { BaseComponent } from "carpet-component-library";
import { unref } from "vue";

/**
 * The LatexInputProps interface is used to define the properties, that are passed from the parent component to the LatexInput component.
 */
export declare interface LatexInputProps extends ComponentProps {}
export interface LatexInputProps extends ComponentProps {
  modelValue?: string; // Der LaTeX-Inhalt wird optional übergeben
}
/**
 * The type of the LatexInput component.
 */
export declare type LatexInputComponentType = "LatexInput";

/**
 * The InputField-component may receive a path to a reference value for the initialization of the input field value.
 */
export declare interface SerializedLatexInputDependencies
  extends SerialisedDependencies {
  referenceValue?: JSONPathExpression;
}

/**
 * The LatexInput-component may utilize a reference value for the initialization of the input field value.
 */
export declare interface LatexInputDependencies
  extends ComponentDependencies {
  referenceValue?: string | undefined | null;
}


/**
 * The InputField-component may hold a static input field value in its componentData.
 */
export declare interface LatexInputComponentData extends ComponentData {
  fieldValue: string | undefined | null;
}

export declare type BasicComparisonOperators =
  | "="
  | "=="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<=";

/**
 * Configuration for basic comparison operations with static values.
 */
export declare interface ComparisonConfiguration {
  value: string | number;
  operator: BasicComparisonOperators;
}

/**
 * Validation strategy that compares static values to the value of the input field.
 */
export declare interface LatexInputValidationConfiguration
  extends ValidationConfiguration {
  comparisons: Array<ComparisonConfiguration>;
}

/**
 * The SerializedLatexInputComponent interface is used to define the serialised properties of the LatexInput component.
 */
export declare interface SerializedLatexInputComponent
  extends SerializedBaseComponent<
    LatexInputComponentType,
    SerializedLatexInputDependencies,
    LatexInputComponentData,
    LatexInputValidationConfiguration
  > {}

/**
 * The InputFieldComponent class is a derived taskComponent, that allows users to enter textual or numeric input.
 */
export class LatexInputComponent extends BaseComponent<
  SerializedLatexInputComponent,
  SerializedLatexInputDependencies,
  LatexInputDependencies,
  LatexInputComponentData,
  LatexInputValidationConfiguration
> {
  /**
   * A InputFieldComponent is valid, if it matches the value in the InputFieldValidationConfiguration.
   * @returns
   */
  /**
   * Validate the LaTeX content entered by the user.
   * @param userValue The LaTeX content provided by the user.
   */
  public validate(userValue: string | undefined | null) {
    const isValid = this.isLatexValid(userValue);
    unref(this.storeObject).setProperty({
      path: `${this.serialisedBaseComponentPath}.isValid`,
      value: isValid,
    });
  }

  /**
   * Basic validation to check if the LaTeX content is valid.
   * For now, this is a placeholder for more complex validation logic.
   * @param latex The LaTeX string to validate.
   * @returns True if valid, false otherwise.
   */
  private isLatexValid(latex: string | undefined | null): boolean {
    if (!latex) return false; // Empty strings are invalid
    try {
      // Example validation logic: Must start with a backslash
      return latex.trim().startsWith("\\");
    } catch {
      return false; // Invalid if an error occurs
    }
  }
}
