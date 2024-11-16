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
 * The BasicInputFieldProps interface is used to define the properties, that are passed from the parent component to the BasicInputField component.
 */
export declare interface BasicInputFieldProps extends ComponentProps {}

/**
 * The type of the BasicInputField component.
 */
export declare type BasicInputFieldComponentType = "BasicInputField";

/**
 * The InputField-component may receive a path to a reference value for the initialization of the input field value.
 */
export declare interface SerializedBasicInputFieldDependencies
  extends SerialisedDependencies {
  referenceValue?: JSONPathExpression;
}

/**
 * The BasicInputField-component may utilize a reference value for the initialization of the input field value.
 */
export declare interface BasicInputFieldDependencies
  extends ComponentDependencies {
  referenceValue?: string | number | undefined | null;
}

/**
 * The FieldConfiguration defines the properties of the BasicInputField component.
 */
export declare interface FieldConfiguration {
  placeholder?: string;
  type: "text" | "number" | "email" | "password";
}

/**
 * The InputField-component may hold a static input field value in its componentData.
 */
export declare interface BasicInputFieldComponentData extends ComponentData {
  fieldConfiguration: FieldConfiguration;
  fieldValue: string | number | undefined | null;
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
export declare interface BasicInputFieldValidationConfiguration
  extends ValidationConfiguration {
  comparisons: Array<ComparisonConfiguration>;
}

/**
 * The SerializedBasicInputFieldComponent interface is used to define the serialised properties of the BasicInputField component.
 */
export declare interface SerializedBasicInputFieldComponent
  extends SerializedBaseComponent<
    BasicInputFieldComponentType,
    SerializedBasicInputFieldDependencies,
    BasicInputFieldComponentData,
    BasicInputFieldValidationConfiguration
  > {}

/**
 * The InputFieldComponent class is a derived taskComponent, that allows users to enter textual or numeric input.
 */
export class BasicInputFieldComponent extends BaseComponent<
  SerializedBasicInputFieldComponent,
  SerializedBasicInputFieldDependencies,
  BasicInputFieldDependencies,
  BasicInputFieldComponentData,
  BasicInputFieldValidationConfiguration
> {
  /**
   * A InputFieldComponent is valid, if it matches the value in the InputFieldValidationConfiguration.
   * @returns
   */
  public validate(userValue: number | string | undefined | null) {
    const validationConfiguration = unref(this.validationConfiguration);

    const isValid = validationConfiguration.comparisons.every((comparison) => {
      const { value, operator } = comparison;

      return this.compareValues(userValue, value, operator);
    });
    unref(this.storeObject).setProperty({
      path: `${this.serialisedBaseComponentPath}.isValid`,
      value: isValid,
    });
  }

  private compareValues(
    userValue: string | number | undefined | null,
    referenceValue: string | number | undefined | null,
    operator: BasicComparisonOperators,
  ) {
    switch (operator) {
      case "=":
        return userValue = referenceValue;
      case "==":
        return userValue == referenceValue;
      case "!=":
        return userValue != referenceValue;
      case ">":
        return <number>userValue > <number>referenceValue;
      case "<":
        return <number>userValue < <number>referenceValue;
      case ">=":
        return <number>userValue >= <number>referenceValue;
      case "<=":
        return <number>userValue <= <number>referenceValue;
    }
  }
}
