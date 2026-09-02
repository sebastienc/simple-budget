import { Router } from 'express';
import { accountsQueries, categoriesQueries, transactionsQueries } from '../db/queries';

export const apiRouter = Router();

apiRouter.get('/accounts', async (_req, res) => {
  res.json(await accountsQueries.list());
});

apiRouter.post('/accounts', async (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  res.status(201).json(await accountsQueries.create({ name }));
});

apiRouter.get('/categories', async (_req, res) => {
  res.json(await categoriesQueries.list());
});

apiRouter.post('/categories', async (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  res.status(201).json(await categoriesQueries.create({ name }));
});

apiRouter.get('/transactions', async (_req, res) => {
  res.json(await transactionsQueries.list());
});

apiRouter.post('/transactions', async (req, res) => {
  const { accountId, categoryId, amountCents, description, occurredOn } = req.body ?? {};
  if (typeof accountId !== 'number' || typeof amountCents !== 'number' || typeof occurredOn !== 'string') {
    res.status(400).json({ error: 'accountId, amountCents, and occurredOn are required' });
    return;
  }
  res.status(201).json(
    await transactionsQueries.create({ accountId, categoryId, amountCents, description, occurredOn }),
  );
});
