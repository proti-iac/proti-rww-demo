const config = {
	preset: "@proti-iac/test-runner",
	globals: {
		proti: {
			testCoordinator: {
				arbitrary: "@proti-iac/pulumi-packages-schema/arbitrary",
				oracles: ["@proti-iac/pulumi-packages-schema/oracle"],
			},
		},
	},
};
module.exports = config;
