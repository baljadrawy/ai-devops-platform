import { Octokit } from '@octokit/rest';
import fetch from 'node-fetch';

/**
 * Plugin للتكامل مع GitHub و Gitea
 */
export class GitHubPlugin {
  constructor(token, giteaUrl = null, giteaToken = null) {
    this.name = 'github';
    this.description = 'التكامل مع GitHub و Gitea';
    
    // GitHub client
    if (token) {
      this.octokit = new Octokit({ auth: token });
    }
    
    // Gitea config
    this.giteaUrl = giteaUrl;
    this.giteaToken = giteaToken;
  }

  getCommands() {
    return {
      'git.repos': this.listRepos.bind(this),
      'git.repo': this.getRepo.bind(this),
      'git.create': this.createRepo.bind(this),
      'git.issues': this.listIssues.bind(this),
      'git.createIssue': this.createIssue.bind(this),
      'git.prs': this.listPullRequests.bind(this),
      'git.commits': this.getCommits.bind(this),
      'git.branches': this.listBranches.bind(this),
      'git.webhook': this.createWebhook.bind(this),
    };
  }

  async listRepos(params) {
    const { owner, type = 'github' } = params;

    try {
      if (type === 'gitea') {
        return await this.giteaRequest(`/users/${owner}/repos`);
      }

      const { data } = await this.octokit.repos.listForUser({ username: owner });
      return {
        success: true,
        data: data.map(repo => ({
          name: repo.name,
          description: repo.description,
          url: repo.html_url,
          stars: repo.stargazers_count,
          forks: repo.forks_count
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getRepo(params) {
    const { owner, repo, type = 'github' } = params;

    try {
      if (type === 'gitea') {
        return await this.giteaRequest(`/repos/${owner}/${repo}`);
      }

      const { data } = await this.octokit.repos.get({ owner, repo });
      return {
        success: true,
        data: {
          name: data.name,
          description: data.description,
          url: data.html_url,
          defaultBranch: data.default_branch,
          language: data.language,
          size: data.size
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createRepo(params) {
    const { name, description = '', private: isPrivate = false, type = 'github' } = params;

    try {
      if (type === 'gitea') {
        return await this.giteaRequest('/user/repos', 'POST', {
          name,
          description,
          private: isPrivate
        });
      }

      const { data } = await this.octokit.repos.createForAuthenticatedUser({
        name,
        description,
        private: isPrivate
      });

      return {
        success: true,
        data: {
          name: data.name,
          url: data.html_url
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async listIssues(params) {
    const { owner, repo, state = 'open', type = 'github' } = params;

    try {
      if (type === 'gitea') {
        return await this.giteaRequest(`/repos/${owner}/${repo}/issues?state=${state}`);
      }

      const { data } = await this.octokit.issues.listForRepo({
        owner,
        repo,
        state
      });

      return {
        success: true,
        data: data.map(issue => ({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          author: issue.user.login,
          url: issue.html_url
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createIssue(params) {
    const { owner, repo, title, body = '', type = 'github' } = params;

    try {
      if (type === 'gitea') {
        return await this.giteaRequest(`/repos/${owner}/${repo}/issues`, 'POST', {
          title,
          body
        });
      }

      const { data } = await this.octokit.issues.create({
        owner,
        repo,
        title,
        body
      });

      return {
        success: true,
        data: {
          number: data.number,
          url: data.html_url
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async listPullRequests(params) {
    const { owner, repo, state = 'open', type = 'github' } = params;

    try {
      if (type === 'gitea') {
        return await this.giteaRequest(`/repos/${owner}/${repo}/pulls?state=${state}`);
      }

      const { data } = await this.octokit.pulls.list({
        owner,
        repo,
        state
      });

      return {
        success: true,
        data: data.map(pr => ({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          author: pr.user.login,
          url: pr.html_url
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getCommits(params) {
    const { owner, repo, branch, limit = 10, type = 'github' } = params;

    try {
      if (type === 'gitea') {
        return await this.giteaRequest(`/repos/${owner}/${repo}/commits?sha=${branch || ''}`);
      }

      const options = { owner, repo, per_page: limit };
      if (branch) options.sha = branch;

      const { data } = await this.octokit.repos.listCommits(options);

      return {
        success: true,
        data: data.map(commit => ({
          sha: commit.sha.substring(0, 7),
          message: commit.commit.message,
          author: commit.commit.author.name,
          date: commit.commit.author.date
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async listBranches(params) {
    const { owner, repo, type = 'github' } = params;

    try {
      if (type === 'gitea') {
        return await this.giteaRequest(`/repos/${owner}/${repo}/branches`);
      }

      const { data } = await this.octokit.repos.listBranches({
        owner,
        repo
      });

      return {
        success: true,
        data: data.map(branch => ({
          name: branch.name,
          protected: branch.protected,
          commit: branch.commit.sha.substring(0, 7)
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createWebhook(params) {
    const { owner, repo, url, events = ['push'], type = 'github' } = params;

    try {
      if (type === 'gitea') {
        return await this.giteaRequest(`/repos/${owner}/${repo}/hooks`, 'POST', {
          type: 'gitea',
          config: { url, content_type: 'json' },
          events,
          active: true
        });
      }

      const { data } = await this.octokit.repos.createWebhook({
        owner,
        repo,
        config: { url, content_type: 'json' },
        events
      });

      return {
        success: true,
        data: { id: data.id, url: data.config.url }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async giteaRequest(path, method = 'GET', body = null) {
    if (!this.giteaUrl || !this.giteaToken) {
      return {
        success: false,
        error: 'Gitea غير مفعّل - تحتاج GITEA_URL و GITEA_TOKEN'
      };
    }

    try {
      const options = {
        method,
        headers: {
          'Authorization': `token ${this.giteaToken}`,
          'Content-Type': 'application/json'
        }
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.giteaUrl}/api/v1${path}`, options);
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Gitea request failed'
        };
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
