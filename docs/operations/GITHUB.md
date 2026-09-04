# GitHub Setup

Local Git is already initialized and configured with:

- `user.name = pipsengine`
- `user.email = pipsengine@gmail.com`

To connect the repo to GitHub:

1. Create an empty repository under the `pipsengine` GitHub account.
2. Do not initialize it with a README or license because this local repo already contains them.
3. Add the remote and push:

```bash
git remote add origin https://github.com/pipsengine/<repo-name>.git
git branch -M main
git push -u origin main
```
