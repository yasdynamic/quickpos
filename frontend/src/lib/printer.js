// WebUSB ESC/POS printer connection manager
// Persists the selected device locally so reconnection is automatic.

const STORAGE_KEY = "quickpos.printer";

// Known vendor IDs for common thermal POS printers
const KNOWN_VENDORS = [
  { vendorId: 0x04b8 }, // Epson
  { vendorId: 0x0519 }, // Star Micronics
  { vendorId: 0x0fe6 }, // ICS Advent / Generic
  { vendorId: 0x1504 }, // Bixolon
  { vendorId: 0x0dd4 }, // Custom Engineering
  { vendorId: 0x067b }, // Prolific (USB-Serial adapters)
  { vendorId: 0x0416 }, // Winbond / Generic
  { vendorId: 0x28e9 }, // Generic Chinese 80mm
  { vendorId: 0x6868 }, // Generic
  { vendorId: 0x0483 }, // STMicro (some thermal MCUs)
  { vendorId: 0x154f }, // Citizen
  { vendorId: 0x1659 }, // Various
];

const supported = () => typeof navigator !== "undefined" && !!navigator.usb;

let currentDevice = null;
let currentEndpointOut = null;

const persist = (device) => {
  if (!device) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ vendorId: device.vendorId, productId: device.productId })
  );
};

const loadStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const findOutEndpoint = (device) => {
  for (const config of device.configurations) {
    for (const iface of config.interfaces) {
      for (const alt of iface.alternates) {
        for (const ep of alt.endpoints) {
          if (ep.direction === "out") {
            return { interfaceNumber: iface.interfaceNumber, endpointNumber: ep.endpointNumber };
          }
        }
      }
    }
  }
  return null;
};

const openDevice = async (device) => {
  if (!device.opened) await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);
  const ep = findOutEndpoint(device);
  if (!ep) throw new Error("Aucun endpoint OUT trouvé sur ce périphérique");
  try {
    await device.claimInterface(ep.interfaceNumber);
  } catch (err) {
    // some Linux/Mac drivers already claim it, try releasing
    try { await device.releaseInterface(ep.interfaceNumber); } catch {/* ignore */}
    await device.claimInterface(ep.interfaceNumber);
  }
  currentDevice = device;
  currentEndpointOut = ep.endpointNumber;
  persist(device);
  return device;
};

export const isSupported = supported;

export const isConnected = () => !!currentDevice && currentDevice.opened;

export const getDeviceLabel = () => {
  if (!currentDevice) return null;
  return (
    currentDevice.productName ||
    `USB ${currentDevice.vendorId.toString(16)}:${currentDevice.productId.toString(16)}`
  );
};

export const requestDevice = async () => {
  if (!supported()) {
    throw new Error("WebUSB non supporté par ce navigateur (utilisez Chrome ou Edge)");
  }
  const device = await navigator.usb.requestDevice({ filters: KNOWN_VENDORS.concat([{}]) });
  return openDevice(device);
};

export const reconnect = async () => {
  if (!supported()) return null;
  const stored = loadStored();
  if (!stored) return null;
  const devices = await navigator.usb.getDevices();
  const found = devices.find(
    (d) => d.vendorId === stored.vendorId && d.productId === stored.productId
  );
  if (!found) return null;
  return openDevice(found);
};

export const disconnect = async () => {
  if (!currentDevice) return;
  try {
    await currentDevice.close();
  } catch {/* ignore */}
  currentDevice = null;
  currentEndpointOut = null;
  persist(null);
};

export const send = async (bytes) => {
  if (!currentDevice || !currentEndpointOut) {
    throw new Error("Imprimante non connectée");
  }
  // chunk large payloads to avoid USB transfer limits
  const CHUNK = 4096;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.slice(i, i + CHUNK);
    await currentDevice.transferOut(currentEndpointOut, slice);
  }
};
