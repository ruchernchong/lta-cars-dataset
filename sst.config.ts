/// <reference path="./.sst/platform/config.d.ts" />

const DOMAIN_NAME = "sgmotortrends.com";

const DOMAIN = {
  development: `dev.api.${DOMAIN_NAME}`,
  staging: `staging.api.${DOMAIN_NAME}`,
  production: `api.${DOMAIN_NAME}`,
} as const;

export default $config({
  app(input) {
    return {
      name: "lta-cars-dataset",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: "ap-southeast-1",
        },
      },
    };
  },
  async run() {
    const api = new sst.aws.Function("Api", {
      architecture: "arm64",
      description: "Hono API for LTA Cars Datasets",
      environment: {
        MONGODB_URI: process.env.MONGODB_URI,
      },
      handler: "src/index.handler",
      url: {
        cors: {
          allowOrigins: [`https://${DOMAIN_NAME}`],
          maxAge: "1 day",
        },
      },
    });

    new sst.aws.Router("LTACarsDataset", {
      domain: DOMAIN[$app.stage],
      routes: {
        "/*": api.url,
      },
    });

    // TODO: To remove the cron scheduler after migrating to the python
    if ($app.stage === "production") {
      new sst.aws.Cron("UpdateCarsJob", {
        schedule: "cron(0/60 0-10 ? * MON-FRI *)",
        job: {
          handler: "src/updater.cars",
          environment: {
            MONGODB_URI: process.env.MONGODB_URI,
          },
        },
      });

      new sst.aws.Cron("UpdateCOEJob", {
        schedule: "cron(0/60 0-10 ? * MON-FRI *)",
        job: {
          handler: "src/updater.coe",
          environment: {
            MONGODB_URI: process.env.MONGODB_URI,
          },
        },
      });

      new sst.aws.Cron("UpdateCOEFirstBiddingJob", {
        schedule: "cron(0/10 8-10 ? * 4#1 *)",
        job: {
          handler: "src/updater.coe",
          environment: {
            MONGODB_URI: process.env.MONGODB_URI,
          },
        },
      });

      new sst.aws.Cron("UpdateCOESecondBiddingJob", {
        schedule: "cron(0/10 8-10 ? * 4#3 *)",
        job: {
          handler: "src/updater.coe",
          environment: {
            MONGODB_URI: process.env.MONGODB_URI,
          },
        },
      });
    }

    return {
      api: api.url,
    };
  },
});
