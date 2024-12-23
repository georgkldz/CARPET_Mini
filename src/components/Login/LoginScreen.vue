<template>
  <div class="login">
    <h1>Anmeldung</h1>
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="email">E-Mail-Adresse</label>
        <input
          id="email"
          v-model="email"
          type="email"
          placeholder="E-Mail eingeben"
          required
        />
      </div>
      <div class="form-group">
        <label for="password">Passwort</label>
        <input
          id="password"
          v-model="password"
          type="password"
          placeholder="Passwort eingeben"
          required
        />
      </div>
      <button type="submit" :disabled="loading">Anmelden</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
import { useApplicationStore } from "stores/applicationStore.ts";

export default defineComponent({
  name: "LoginScreen",
  setup() {
    const appStore = useApplicationStore();

    const email = ref<string>("");
    const password = ref<string>("");
    const loading = ref<boolean>(false);
    const error = ref<string | null>(null);

    const handleSubmit = async () => {
      error.value = null;
      loading.value = true;

      try {
        await appStore.login({ email: email.value, password: password.value });
      } catch (err) {
        if (err instanceof Error) {
          error.value = err.message || "Anmeldung fehlgeschlagen.";
        } else {
          error.value = "Ein unbekannter Fehler ist aufgetreten.";
        }
      } finally {
        loading.value = false;
      }
    };

    return {
      email,
      password,
      loading,
      error,
      handleSubmit,
    };
  },
});
</script>

<style scoped>
.login {
  max-width: 400px;
  margin: 50px auto;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 5px;
  background: #f9f9f9;
}

.form-group {
  margin-bottom: 15px;
}
h1 {
  font-size: 24px;
  margin-bottom: 20px;
  text-align: center;
  word-wrap: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

input {
  width: 100%;
  padding: 8px;
  box-sizing: border-box;
}

button {
  width: 100%;
  padding: 10px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
}

button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}

.error {
  color: red;
  margin-top: 10px;
  text-align: center;
}
</style>
