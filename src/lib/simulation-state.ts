// This is a simple in-memory store for demonstration.
// In a real production app, you'd use a database or a more robust caching solution like Redis.
export let attackMode = false;

export const setAttackMode = (status: boolean) => {
  attackMode = status;
};
