import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const greeting = 'Hello, Hardhat!';
const initialRate = 1000;
const finalRate = 10;
const openingTime = new Date('2022-09-26T09:00:00').valueOf();
const closingTime = new Date('2022-09-30T17:00:00').valueOf();

task('deploy', 'Deploy contracts').setAction(
  async (_, hre: HardhatRuntimeEnvironment): Promise<void> => {
    const [owner] = await hre.ethers.getSigners();

    const Greeter = await hre.ethers.getContractFactory('Greeter');
    const greeter = await Greeter.deploy(greeting);
    await greeter.deployed();
    console.log('Greeter deployed to:', greeter.address);

    const BTMX = await hre.ethers.getContractFactory('BITMarketsToken');
    // Upgradeable
    // const btmx = await hre.upgrades.deployProxy(BTMX, undefined, {
    //   initializer: 'store'
    // }); //
    const btmx = await BTMX.deploy();
    await btmx.deployed();

    console.log('BITMarketsToken deployed to:', btmx.address);

    const btmxTotalSupply = await btmx.totalSupply();
    const cap = btmxTotalSupply.div(5);

    const ICO = await hre.ethers.getContractFactory('BITMarketsTokenCrowdsale');
    const ico = await ICO.deploy(
      initialRate,
      owner.address,
      btmx.address,
      cap,
      openingTime,
      closingTime,
      finalRate
    );
    console.log('BITMarketsToken ico deployed to:', ico.address);

    await btmx.approve(ico.address, cap);

    console.log('BITMarketsToken ico has allowance of: ', cap);
  }
);
