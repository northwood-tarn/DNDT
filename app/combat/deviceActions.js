export function createCatastrophicChargeVariant(charge, device) {
  const deviceEffect = structuredClone(device.deviceEffect);
  const id = `${charge.id}:${device.id}`;
  if (deviceEffect?.kind === "weapon_damage_buff") {
    deviceEffect.catastrophicStackGroup = id;
  }
  return {
    ...structuredClone(device),
    id,
    iconId: device.iconId,
    name: `Catastrophic Charge: ${device.name}`,
    description: `${charge.description}\n${device.description}`,
    cost: charge.cost,
    resourceId: charge.resourceId,
    uses: structuredClone(charge.uses),
    deviceEffect,
    repeatResolutionCount: 2,
    additionalResourceIds: ["prepared_devices"],
    tags: {
      ...(device.tags || {}),
      ...(charge.tags || {}),
      device: true,
      harmful: device.tags?.harmful === true,
      catastrophicChargeOption: true,
    },
  };
}
