"use strict";

const path = require("path");
const AutoLoad = require("@fastify/autoload");
const oauthPlugin = require("@fastify/oauth2");
const axios = require("axios");
const errors = require("http-errors");

module.exports = async function (fastify, opts) {
  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, "plugins"),
    options: Object.assign({}, opts),
  });

  fastify.register(oauthPlugin, {
    name: "googleOAuth2",
    credentials: {
      client: {
        id: "54941201901-8phkcvj0v7aekvd3gc05hrc7m8sjqh2u.apps.googleusercontent.com",
        secret: "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",
      },
      auth: oauthPlugin.GOOGLE_CONFIGURATION,
    },
    // register a fastify url to start the redirect flow
    startRedirectPath: "/login",
    // google redirect here after the user login
    callbackUri: "http://127.0.0.1:3000/callback",
    scope: ["profile"],
    checkStateFunction: (_request, callback) => callback(),
    generateStateFunction: () => 123,
  });

  fastify.get("/callback", async function (request, reply) {
    const { token } =
      await this.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

    reply.setCookie("token", token.access_token, { secure: true });
    reply.send({ token });
  });

  fastify.post("/refresh", async function (request, reply) {
    const token = request.body.token;

    if (!token) {
      reply.status(404).send({ message: "refresh token not found" });
    }

    const response = await this.googleOAuth2.getNewAccessTokenUsingRefreshToken(
      token
    );

    reply.setCookie("token", response.access_token, {
      secure: true,
    });

    reply.send(response);
  });

  fastify.get(
    "/protected/cats",
    {
      preValidation: [validateToken],
    },
    async function (_request, reply) {
      const { data } = await axios.get(
        "https://cataas.com/cat?type=square&fit=cover&position=top"
      );

      reply.type("image/jpeg").send(data);
    }
  );

  fastify.get("/unprotected/cats", {}, async function (_request, reply) {
    const { data } = await axios.get(
      "https://cataas.com/cat?type=square&fit=cover&position=top"
    );

    reply.type("image/jpeg").send(data);
  });
};

const validateToken = async (req) => {
  {
    const token = req?.cookies?.token;

    if (!token) throw new errors.Forbidden("Token not present");

    const response = await axios.get(
      "https://oauth2.googleapis.com/tokeninfo?access_token=" + token
    );

    if (response.status !== 200) {
      throw new errors.Forbidden("Invalid Token");
    }
  }
};
