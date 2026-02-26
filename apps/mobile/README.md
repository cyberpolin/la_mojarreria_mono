# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npm run env:generate
    npx expo start
   ```

## Environment Config

This project generates `constants/config.ts` from your env file.

- Default env file: `.env`
- Optional local env file: `.env.local`

Generate constants after changing env values:

```bash
npm run env:generate
```

Generate constants from `.env.local`:

```bash
npm run env:generate:local
```

Recommended workflow:

1. Edit `.env` or `.env.local`.
2. Run the matching env generate command.
3. Start/build the app.

## Sentry

Sentry is initialized in `App.tsx` from `APP_CONFIG.sentry`.

Required public env keys:

- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_SENTRY_ENABLED` (`true`/`false`)
- `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (example: `0.2`)

Build-time keys for source map upload:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

After changing env values, regenerate config:

```bash
npm run env:generate
```

Note: consider adding the script call to zshrc on change directory

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
