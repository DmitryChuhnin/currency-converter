<template>
  <div id="main">
    <CurrencyConverter />
  </div>
</template>

<script setup lang="ts">
import CurrencyConverter from './components/CurrencyConverter.vue'
</script>

<style lang="scss">
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  //align-items: center;
  justify-content: center;

  #app {
    width: 100%;
    padding: 20px;
  }
}

#main {
  background: white;
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 90vw;
  margin: 20px auto;
}
</style>
