import path from 'path';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import wd from 'wd';
import axios from 'axios';
import { HOST, PORT } from './helpers/session';
import { APIDEMO_CAPS, GPS_CAPS } from './desired';
import { startServer } from '../..';


chai.should();
chai.use(chaiAsPromised);

describe('EspressoDriver', function () {
  let driver;
  let server;
  before(async function () {
    server = await startServer(PORT, HOST);
    driver = wd.promiseChainRemote(HOST, PORT);
  });
  after(async function () {
    try {
      await server.close();
    } catch (ign) {}
  });
  describe('createSession', function () {
    describe('success', function () {
      afterEach(async function () {
        try {
          await driver.quit();
        } catch (ign) {}
      });

      it('should start android session focusing on default activity', async function () {
        let status = await driver.init(APIDEMO_CAPS);

        status[1].app.should.eql(APIDEMO_CAPS.app);

        let activity = await driver.getCurrentDeviceActivity();
        activity.should.equal('.ApiDemos');
      });
      it('should start android session focusing on specified activity', async function () {
        // for now the activity needs to be fully qualified
        let status = await driver.init(Object.assign({
          appActivity: 'io.appium.android.apis.accessibility.AccessibilityNodeProviderActivity'
        }, APIDEMO_CAPS));

        status[1].app.should.eql(APIDEMO_CAPS.app);

        let activity = await driver.getCurrentDeviceActivity();
        activity.should.equal('.accessibility.AccessibilityNodeProviderActivity');
      });
      // TODO: Replace GPS app with something that doesn't pop up a warning modal
      it.skip('should start subsequent sessions with different apps', async function () {
        let status = await driver.init(GPS_CAPS);

        status[1].app.should.eql(GPS_CAPS.app);

        let activity = await driver.getCurrentDeviceActivity();
        activity.should.equal('.GPSTest');

        await driver.quit();

        status = await driver.init(APIDEMO_CAPS);

        status[1].app.should.eql(APIDEMO_CAPS.app);

        activity = await driver.getCurrentDeviceActivity();
        activity.should.equal('.ApiDemos');
      });
    });
    describe('failure', function () {
      it('should reject start session for non-existent activity', async function () {
        // for now the activity needs to be fully qualified
        await driver.init(Object.assign({
          appActivity: 'io.appium.android.apis.some.fake.Activity'
        }, APIDEMO_CAPS)).should.eventually.be.rejected;
      });
      it('should reject opening of appPackage with incorrect signature', async function () {
        await driver.init(Object.assign({
          appPackage: 'com.android.settings',
        }, APIDEMO_CAPS)).should.eventually.be.rejected;
      });
      it('should reject start session for internet permissions not set', async function () {
        // for now the activity needs to be fully qualified
        await driver.init(Object.assign({}, APIDEMO_CAPS, {
          app: path.resolve('test', 'assets', 'ContactManager.apk'),
        })).should.eventually.be.rejectedWith(/INTERNET/);
      });
    });
  });
  describe('.startActivity', function () {
    afterEach(async function () {
      try {
        await driver.quit();
      } catch (ign) {}
    });
    it('should start activity by name', async function () {
      await driver.init(APIDEMO_CAPS);
      await driver.startActivity({
        appPackage: 'io.appium.android.apis',
        appActivity: '.accessibility.AccessibilityNodeProviderActivity',
      });
      await driver.getCurrentDeviceActivity().should.eventually.eql('.accessibility.AccessibilityNodeProviderActivity');
    });
    it('should start activity by fully-qualified name', async function () {
      await driver.init(APIDEMO_CAPS);
      await driver.startActivity({
        appPackage: 'io.appium.android.apis',
        appActivity: 'io.appium.android.apis.accessibility.AccessibilityNodeProviderActivity',
      });
      await driver.getCurrentDeviceActivity().should.eventually.eql('.accessibility.AccessibilityNodeProviderActivity');
    });
  });

  describe('.reset', function () {
    afterEach(async function () {
      try {
        await driver.quit();
      } catch (ign) {}
    });
    it('should raise an error for resetApp', async function () {
      await driver.init(APIDEMO_CAPS);
      await driver.resetApp(APIDEMO_CAPS).should.eventually.be.rejectedWith(/Please quit the session and create a new one/);
    });
  });

  describe('keys', function () {
    beforeEach(async function () {
      await driver.init({
        ...APIDEMO_CAPS,
        appActivity: 'io.appium.android.apis.view.AutoComplete1',
        autoGrantPermissions: true,
      });
    });
    afterEach(async function () {
      await driver.quit();
    });
    it('should send keys to focused-on element', async function () {
      await driver.keys('Hello World!'.split(''));
      const editEl = await driver.elementByXPath('//android.widget.AutoCompleteTextView');
      await editEl.text().should.eventually.equal('Hello World!');
      await editEl.clear();
    });

    it('should do long press keycode', async function () {
      const KEYCODE_G = 35;
      const META_SHIFT_MASK = 193;
      let sessionId = await driver.getSessionId();

      const endpoints = ['long_press_keycode', 'press_keycode'];
      for (let endpoint of endpoints) {
        await axios({
          method: 'POST',
          url: `http://${HOST}:${PORT}/wd/hub/session/${sessionId}/appium/device/${endpoint}`,
          data: {
            keycode: KEYCODE_G,
            metastate: 0 | META_SHIFT_MASK,
          },
        });
        const editEl = await driver.elementByXPath('//android.widget.AutoCompleteTextView');
        await editEl.text().should.eventually.equal(endpoint === 'press_keycode' ? 'G' : 'GG');
        await editEl.clear();
      }
    });
  });
});
