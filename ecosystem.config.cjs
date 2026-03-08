module.exports = {
  apps: [
    {
      name: 'cnam-vms',
      script: 'npm',
      args: 'start',
      env: {
        PORT: '3001',
      },
    },
  ],
};
