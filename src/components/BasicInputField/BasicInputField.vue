<template>
  <input
    class="basicInputField"
    :value="value"
    @input="onUserInput"
    :placeholder="fieldConfiguration.placeholder ?? ''"
    :type="fieldConfiguration.type"
  />
</template>

<script lang="ts" setup>
import { onMounted, watch, toRefs, unref, ref } from "vue";
import type { Ref } from "vue";
import { BasicInputFieldComponent } from "src/components/BasicInputField/BasicInputField";
import type { BasicInputFieldProps } from "src/components/BasicInputField/BasicInputField";

const props = defineProps<BasicInputFieldProps>();
const { storeObject, componentID, componentPath } = toRefs(props);

const component = new BasicInputFieldComponent(
  storeObject,
  unref(componentID),
  unref(componentPath),
);
const componentData = component.getComponentData();
const fieldConfiguration = unref(componentData).fieldConfiguration;

const dependencies = component.loadDependencies();

const value: Ref<number | string> = ref("");

onMounted(() => {
  value.value =
    <string | number>dependencies.value.referenceValue ??
    unref(componentData).fieldValue;
  component.validate(<string | number>value.value);
});

watch(
  () => dependencies.value.referenceValue,
  (newValue, oldValue) => {
    if (newValue !== oldValue) {
      value.value = <string | number>newValue;
      component.validate(<string | number>value.value);
    }
  },
);

const onUserInput = (event: Event) => {
  const newValue = (<HTMLInputElement>event.target).value;

  unref(storeObject).setProperty({
    path: `${component.getComponentPath()}.component.fieldValue`,
    value: newValue,
  });
};
</script>

<style>
.basicInputField {
  width: 100%;
}
</style>
