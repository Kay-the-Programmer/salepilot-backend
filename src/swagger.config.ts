import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SalePilot API',
      version: '1.0.0',
      description: 'API documentation for SalePilot POS Backend',
      contact: {
        name: 'SalePilot Team',
      },
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? (process.env.BACKEND_URL || 'https://your-production-url.com')
          : `http://localhost:${process.env.PORT || 5000}`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/api/*.routes.ts',
    './src/controllers/*.controller.ts',
    './src/api/index.ts',
  ],
};

const specs = swaggerJsdoc(options);

export default specs;