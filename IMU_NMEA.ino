#include "Madgwick.h"
#include <FastIMU.h>
#include <Wire.h>
#include <MS5x.h>

#define LED_A 13
#define LED_B 31
#define LED_C 30
MPU6050_HMC5883L IMU;     //Change to the name of any supported IMU!
#define IMU_ADDRESS 0x68  //Change to the address of the IMU
MS5x barometer(&Wire);

// #define RAW // output raw uncalibrated sensor data
#define MADGWICK 0.5 // filter gain
#define NMEA 500 // NMEA send delay

calData calib = { 0 };
AccelData IMUAccel;
GyroData IMUGyro;
MagData IMUMag;
#ifdef MADGWICK
Madgwick filter;
#endif

float acal[3][4] = {
  { 0.9919658449907438, -0.002343058092915072, 0.0003887165028070656, -0.011546756506892636 },
  { -0.002343058092915116, 0.9903069931236413, -0.0008911156023119728, -0.001046553492961346 },
  { 0.000388716502807076, -0.0008911156023119701, 1.0053053265440286, -0.021913221417802796 },
};

float gcal[3] = { -14.230965747139809, -1.5669362652501644, 0.6011291536983048 };

float mcal[3][4] = {
  { 0.0024946377773136276, 4.076087838717894e-05, 1.9155611936636995e-05, 0.020249826392704954 },
  { 4.076087838717894e-05, 0.002578933165033627, 7.760980227345709e-06, 0.12156994725753643 },
  { 1.915561193663699e-05, 7.760980227345697e-06, 0.002807913744043087, -0.00973518290526266 },
};

void setup() {
  pinMode(LED_A, OUTPUT);
  Wire.begin();
  Wire.setClock(400000);  //400khz clock

  Serial.begin(115200);
  while (!Serial) { delay(10); }
  Serial3.begin(9600);
  while (!Serial3) { delay(10); }
  Serial3.setTimeout(100);
  unsigned char cfg[] = { 0xB5, 0x62, 0x06, 0x00, 0x14, 0x00 };  // Baud 57600
  Serial3.write(cfg, 6);

  int err = IMU.init(calib, IMU_ADDRESS);
  if (err != 0) {
    Serial.print("Error IMU");
    while (true) {
      digitalWrite(LED_A, 1 - digitalRead(LED_A));
      delay(500);
    }
  }

  IMU.setIMUGeometry(0);

  filter.begin(MADGWICK);

  err = barometer.connect();
  if (err != 0) {
    Serial.print("Error BAROMETER");
    while (true) {
      digitalWrite(LED_A, 1 - digitalRead(LED_A));
      delay(500);
    }
  }
}


byte buf[256];
long t = millis();

void loop() {
  IMU.update();
  IMU.getAccel(&IMUAccel);
  IMU.getGyro(&IMUGyro);
  IMU.getMag(&IMUMag);


#ifdef RAW
  Serial.print(IMUAccel.accelX, 8);
  Serial.print(" ");
  Serial.print(IMUAccel.accelY, 8);
  Serial.print(" ");
  Serial.print(IMUAccel.accelZ, 8);

  Serial.print(" ");
  Serial.print(IMUGyro.gyroX, 8);
  Serial.print(" ");
  Serial.print(IMUGyro.gyroY, 8);
  Serial.print(" ");
  Serial.print(IMUGyro.gyroZ, 8);

  Serial.print(" ");
  Serial.print(IMUMag.magX, 8);
  Serial.print(" ");
  Serial.print(IMUMag.magY, 8);
  Serial.print(" ");
  Serial.print(IMUMag.magZ, 8);
  Serial.println();
#else
  transform((float*)&IMUAccel, acal);
  muladd((float*)&IMUGyro, -1, gcal);
  transform((float*)&IMUMag, mcal);
#endif

#ifdef MADGWICK
  filter.update(IMUGyro.gyroX, IMUGyro.gyroY, IMUGyro.gyroZ,
                IMUAccel.accelX, IMUAccel.accelY, IMUAccel.accelZ,
                IMUMag.magX, IMUMag.magY, IMUMag.magZ);

  float w = filter.getQuatW();
  float x = filter.getQuatX();
  float y = filter.getQuatY();
  float z = filter.getQuatZ();
  float roll = -atan2f(2.0 * (z * y + w * x), 1.0 - 2.0 * (x * x + y * y));
  float pitch = asinf(2.0 * (y * w - z * x));
  float heading = atan2f(2.0 * (z * w + x * y), -1.0 + 2.0 * (w * w + x * x));
#else
  float a[3] = { IMUAccel.accelX, -IMUAccel.accelY, IMUAccel.accelZ };
  scale(a, 1 / norm(a));
  float m[3] = { IMUMag.magX, -IMUMag.magY, IMUMag.magZ };
  float pitch = -asinf(a[0]);
  float roll = asinf(a[1] / cosf(pitch));
  float x = cosf(pitch) * m[0] + sinf(pitch) * m[2];
  float y = sinf(roll) * sinf(pitch) * m[0] + cosf(roll) * m[1] - sinf(roll) * cosf(pitch) * m[2];
  float heading = atan2f(y, x);
#endif

  heading = fmod(540 - heading * 180 / PI, 360);
  heading = heading > 359.95 ? 0 : heading;

#ifdef NMEA
  long u = millis();
  if (u - t > NMEA) {
    t = u;
    barometer.checkUpdates();
    Serial.print("$HCHDM,");
    Serial.print(heading, 1);
    Serial.println(",M");
    Serial.print("$HCXDR,A,");
    Serial.print(pitch * 180 / PI, 1);
    Serial.print(",D,PITCH,A,");
    Serial.print(roll * 180 / PI, 1);
    Serial.println(",D,ROLL");
    Serial.print("$HCXDR,C,");
    Serial.print(barometer.GetTemp(), 1);
    Serial.print(",C,TEMPERATURE,P,");
    Serial.print(barometer.GetPres(), 0);
    Serial.println(",P,PRESSURE");
  }

  if (Serial3.available()) {
    digitalWrite(LED_A, HIGH);
    size_t n = Serial3.readBytesUntil('\n', buf, 256);
    Serial.write(buf, n);
    Serial.println();
    digitalWrite(LED_A, LOW);
  }
#else
  Serial.print(pitch * 180 / PI, 1);
  Serial.print(" ");
  Serial.print(roll * 180 / PI, 1);
  Serial.print(" ");
  Serial.print(heading, 1);
  Serial.println();
#endif

  delay(50);
}

void transform(float v[], float M[3][4]) {
  float w[] = { v[0], v[1], v[2], 1 };
  v[0] = v[1] = v[2] = 0;
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 4; j++) {
      v[i] += M[i][j] * w[j];
    }
  }
}

float dot(float v[], float w[]) {
  return v[0] * w[0] + v[1] * w[1] + v[2] * w[2];
}

float norm(float v[]) {
  return sqrtf(dot(v, v));
}

void scale(float v[], float a) {
  v[0] *= a;
  v[1] *= a;
  v[2] *= a;
}

void add(float v[], float w[]) {
  v[0] += w[0];
  v[1] += w[1];
  v[2] += w[2];
}

void sub(float v[], float w[]) {
  v[0] -= w[0];
  v[1] -= w[1];
  v[2] -= w[2];
}

void muladd(float v[], float a, float w[]) {
  v[0] += a * w[0];
  v[1] += a * w[1];
  v[2] += a * w[2];
}
