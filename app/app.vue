<template>
  <UApp>
    <!-- Skips animations for visitors who turned on "reduce motion" in their OS -->
    <MotionConfig reduced-motion="user">
      <div>
        <NuxtRouteAnnouncer />
        <NuxtWelcome />
      </div>
    </MotionConfig>
  </UApp>
</template>
