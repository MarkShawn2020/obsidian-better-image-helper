#   
Submit your plugin

If you want to share your plugin with the Obsidian community, the best way is to submit it to the [official list of plugins](https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugins.json). Once we've reviewed and published your plugin, users can install it directly from within Obsidian. It'll also be featured in the [plugin directory](https://obsidian.md/plugins) on the Obsidian website.

You only need to submit the initial version of your plugin. After your plugin has been published, users can download new releases from GitHub directly from within Obsidian.

## Prerequisites 

To complete this guide, you'll need:

- A [GitHub](https://github.com/signup) account.

## Before you begin 

Before you submit your plugin, make sure you have the following files in the root folder of your repository:

- A `README.md` that describes the purpose of the plugin, and how to use it.
- A `LICENSE` that determines how others are allowed to use the plugin and its source code. If you need help to [add a license](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/adding-a-license-to-a-repository) for your plugin, refer to [Choose a License](https://choosealicense.com/).
- A `manifest.json` that describes your plugin. For more information, refer to [Manifest](https://docs.obsidian.md/Reference/Manifest).

## Step 1: Publish your plugin to GitHub 

Template repositories

If you created your plugin from one of our template repositories, you may skip this step.

To review your plugin, we need to access to the source code on GitHub. If you're unfamiliar with GitHub, refer to the GitHub docs for how to [Create a new repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository).

## Step 2: Create a release 

In this step, you'll prepare a release for your plugin that's ready to be submitted.

1. In `manifest.json`, update `version` to a new version that follows the [Semantic Versioning](https://semver.org/) specification, for example `1.0.0` for your initial release. You can only use numbers and periods (`.`).
    
2. [Create a GitHub release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository#creating-a-release). The "Tag version" of the release must match the version in your `manifest.json`.
    
3. Enter a name for the release, and describe it in the description field. Obsidian doesn't use the release name for anything, so feel free to name it however you like.
    
4. Upload the following plugin assets to the release as binary attachments:
    
    - `main.js`
    - `manifest.json`
    - `styles.css` (optional)

## Step 3: Submit your plugin for review 

In this step, you'll submit your plugin to the Obsidian team for review.

1. In [community-plugins.json](https://github.com/obsidianmd/obsidian-releases/edit/master/community-plugins.json), add a new entry at the end of the JSON array.
    
    ```json
    {
      "id": "doggo-dictation",
      "name": "Doggo Dictation",
      "author": "John Dolittle",
      "description": "Transcribes dog speech into notes.",
      "repo": "drdolittle/doggo-dictation"
    }
    ```
    
    - `id`, `name`, `author`, and `description` determines how your plugin appears to the user, and should match the corresponding properties in your [Manifest](https://docs.obsidian.md/Reference/Manifest).
    - `id` is unique to your plugin. Search `community-plugins.json` to confirm that there's no existing plugin with the same id. The `id` can't contain `obsidian`.
    - `repo` is the path to your GitHub repository. For example, if your GitHub repo is located at [https://github.com/your-username/your-repo-name](https://github.com/your-username/your-repo-name), the path is `your-username/your-repo-name`.
    
    Remember to add a comma after the closing brace, `}`, of the previous entry.
    
2. Select **Commit changes...** in the upper-right corner.
    
3. Select **Propose changes**.
    
4. Select **Create pull request**.
    
5. Select **Preview**, and then select **Community Plugin**.
    
6. Click **Create pull request**.
    
7. In the name of the pull request, enter "Add plugin: [...]", where [...] is the name of your plugin.
    
8. Fill in the details in the description for the pull request. For the checkboxes, insert an `x` between the brackets, `[x]`, to mark them as done.
    
9. Click **Create pull request** (for the last time 🤞).
    

You've now submitted your plugin to the Obsidian plugin directory. Sit back and wait for an initial validation by our friendly bot. It may take a few minutes before the results are ready.

- If you see a **Ready for review** label on your PR, your submission has passed the automatic validation.
- If you see a **Validation failed** label on your PR, you need to address all listed issues until the bot assigns a **Ready for review** label.

Once your submission is ready for review, you can sit back and wait for the Obsidian team to review it.

How long does it take to review my plugin?

The time it takes to review your submission depends on the current workload of the Obsidian team. The team is still small, so please be patient while you wait for your plugin to be reviewed. We're currently unable to give any estimates on when we'll be able to review your submission.

## Step 4: Address review comments 

Once a reviewer has reviewed your plugin, they'll add a comment to your pull request with the result of the review. The reviewer may require that you update your plugin, or they can offer suggestions on how you can improve it.

Address any required changes and update the GitHub release with the new changes. Leave a comment on the PR to let us know you've addressed the feedback. Don't open a new PR.

We'll publish the plugin as soon we've verified that all required changes have been addressed.

Note

While only Obsidian team members can publish your plugin, other community members may also offer to review your submission in the meantime.

## Next steps 

Once we've reviewed and published your plugin, it's time to announce it to the community:

- Announce in [Share & showcase](https://forum.obsidian.md/c/share-showcase/9) in the forums.
- Announce in the `#updates` channel on [Discord](https://discord.gg/veuWUTm). You need the [`developer` role](https://discord.com/channels/686053708261228577/702717892533157999/830492034807758859) to post in `#updates`.

Links to this page

[Beta-testing plugins](https://docs.obsidian.md/Plugins/Releasing/Beta-testing+plugins)

[Home](https://docs.obsidian.md/Home)

[Release your plugin with GitHub Actions](https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions)