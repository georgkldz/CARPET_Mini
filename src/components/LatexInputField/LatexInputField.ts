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
import katex from "katex";
import type { QInputProps } from "quasar";


/**
 * The LatexInputFieldProps interface is used to define the properties, that are passed from the parent component to the LatexInputField component.
 */
export declare interface LatexInputFieldProps extends ComponentProps {}
export interface LatexInputFieldProps extends ComponentProps {
  modelValue?: string; // Der LaTeX-Inhalt wird optional übergeben
}
/**
 * The type of the LatexInputField component.
 */
export declare type LatexInputFieldComponentType = "LatexInputField";

/**
 * The InputField-component may receive a path to a reference value for the initialization of the input field value.
 */
export interface SerializedLatexInputFieldDependencies
  extends SerialisedDependencies {
  referenceValue?: JSONPathExpression;
}

/**
 * The LatexInputField-component may utilize a reference value for the initialization of the input field value.
 */
export interface LatexInputFieldDependencies extends ComponentDependencies {
  referenceValue?: string | undefined | null;
}

export interface FieldConfiguration extends Omit<QInputProps, "modelValue" | "inputStyle"> {
  placeholder?: string;
  prepend?: string;
}

/**
 * The InputField-component may hold a static input field value in its componentData.
 */
export declare interface LatexInputFieldComponentData extends ComponentData {
  fieldConfiguration: FieldConfiguration;
  fieldValue: string | undefined | null;
}

/**
 * Configuration for basic comparison operations with static values.
 */
export declare interface ComparisonConfiguration {
}

/**
 * Validation strategy that compares static values to the value of the input field.
 */
export declare interface LatexInputFieldValidationConfiguration
  extends ValidationConfiguration {
  comparisons: Array<ComparisonConfiguration>;
}

/**
 * The SerializedLatexInputFieldComponent interface is used to define the serialised properties of the LatexInputField component.
 */
export declare interface SerializedLatexInputFieldComponent
  extends SerializedBaseComponent<
    LatexInputFieldComponentType,
    SerializedLatexInputFieldDependencies,
    LatexInputFieldComponentData,
    LatexInputFieldValidationConfiguration
  > {}

/**
 * The InputFieldComponent class is a derived taskComponent, that allows users to enter textual or numeric input.
 */
export class LatexInputFieldComponent extends BaseComponent<
  SerializedLatexInputFieldComponent,
  SerializedLatexInputFieldDependencies,
  LatexInputFieldDependencies,
  LatexInputFieldComponentData,
  LatexInputFieldValidationConfiguration
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
    const error = this.getSyntaxError(userValue);
    const isValid = error === null || userValue?.toString() == "";

    unref(this.storeObject).setProperty({
      path: `${this.serialisedBaseComponentPath}.isValid`,
      value: isValid,
    });
  }


  /**
   * Checks the LaTeX syntax and returns either null or an error message.
   * @param latex The LaTeX string to validate.
   * @returns Null if the syntax is valid, or an error message if it is not.
   */

  public getSyntaxError(latex: string | undefined | null): string | null {
    if (!latex || latex.trim() === "") return "Leerer Input ist ungültig.";

    try {
      katex.renderToString(latex, { throwOnError: true });
      return null; // Kein Fehler
    } catch (error) {
      return error instanceof Error ? error.message : "Unbekannter Fehler.";
    }
  }

}

