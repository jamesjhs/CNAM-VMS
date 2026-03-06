module.exports = {
  apps: [
    {
      name: 'cnam-vms',
      script: 'npm',
      args: 'start',
      env: {
        PORT: '3001',
        AUTH_URL: 'https://cnam.jahosi.co.uk',
      },
    },
  ],
};
