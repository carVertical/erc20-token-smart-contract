import chai, { expect } from "chai";
import { solidity, MockProvider, deployContract } from "ethereum-waffle";
import { ecsign } from "ethereumjs-util";
import { Contract, BigNumber, constants, utils } from "ethers";

const { MaxUint256 } = constants;
const { hexlify } = utils;

chai.use(solidity);

import cVToken from '../build/cVToken.json';
import { expandTo18Decimals, getApprovalDigest } from "./utils";

const OneToken = expandTo18Decimals(1);
const TEST_AMOUNT = expandTo18Decimals(10);

describe('cVToken', function () {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: "istanbul",
      mnemonic: "toss toss toss toss toss toss toss toss toss toss toss toss",
      gasLimit: 9999999
    }
  });
  const wallets = provider.getWallets();
  const [wallet, other] = wallets;

  let token: Contract;
  beforeEach(async () => {
    token = await deployContract(wallet, cVToken);
  });
  
  describe('transferMany()', () => {
    it('should send to 100 users', async () => {
      const N = 100;
      const to = [];
      const value = [];
      for (let i = 0; i < N; i++) {
        const account = provider.createEmptyWallet();
        to.push(account.address);
        value.push(OneToken);
      }

      const tx = await token.transferMany(to, value);
      const data = await tx.wait();
      console.log('Gas Used:', data.gasUsed.toString());
      for (let i = 0; i < N; i++) {
        expect(await token.balanceOf(to[i])).eq(OneToken);
      }
    });
  });

  describe('transferFrom()', () => {
    it('should not decrease max uint256 approve', async () => {
      await token.approve(other.address, MaxUint256);
      await expect(
        token
          .connect(other)
          .transferFrom(wallet.address, other.address, TEST_AMOUNT)
      )
        .to.emit(token, "Transfer")
        .withArgs(wallet.address, other.address, TEST_AMOUNT);
      
      expect(await token.allowance(wallet.address, other.address)).eq(MaxUint256);
    });
  });

  describe('permit', () => {
    it('should permit()', async () => {
      const nonce = await token.nonces(wallet.address);
      const deadline = MaxUint256;
      const digest = await getApprovalDigest(
        token,
        { owner: wallet.address, spender: other.address, value: TEST_AMOUNT },
        nonce,
        deadline
      );

      const { v, r, s } = ecsign(
        Buffer.from(digest.slice(2), "hex"),
        Buffer.from(wallet.privateKey.slice(2), "hex")
      );

      await expect(
        token.permit(
          wallet.address,
          other.address,
          TEST_AMOUNT,
          deadline,
          v,
          hexlify(r),
          hexlify(s)
        )
      )
        .to.emit(token, "Approval")
        .withArgs(wallet.address, other.address, TEST_AMOUNT);
      expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT);
      expect(await token.nonces(wallet.address)).to.eq(BigNumber.from(1));
    });
  });
});